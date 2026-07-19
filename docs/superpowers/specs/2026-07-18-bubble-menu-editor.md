# Campaign Template Editor — Specification (Final)

> **Status:** Approved for Development

---

## 1. Value

Replace the raw `<Textarea>` with Unlayer's visual email builder (`react-email-editor@2.0.0`) hosted in `@repo/editor`. Users get a drag-and-drop email layout editor with native merge tag insertion for Jinja2 tokens, and clean HTML + JSON output.

> ⚠️ **License & Infrastructure Note:** While the wrapper library (`react-email-editor`) is open-source (MIT), the core editor engine is a closed-source SaaS tool delivered via iframe from Unlayer's CDNs (`editor.unlayer.com`). The application **requires runtime internet access** to load the editor canvas and cannot operate in air-gapped or completely offline environments.

---

## 2. Architecture

```
Admin page → Dynamically imports { TenantEditor } with { ssr: false }
                                         │
                    ┌────────────────────┴────────────────────┐
                    │  packages/editor wraps react-email-editor │
                    │  (Unlayer via client-only SaaS iframe)  │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │  options   → Memoized configuration      │
                    │  onReady   → Guarded loadDesign(json)   │
                    │  onSave    → editor.exportHtml(cb)         │
                    └─────────────────────────────────────────┘

```

---

## 3. Package Changes

### `apps/admin/package.json`

- Remove `@react-email/editor` dependency (admin consumes editor via `@repo/editor` only).

### `packages/editor/src/index.tsx`

- Wrap Unlayer's `EmailEditor` from `react-email-editor`.
- Export `TenantEditor` with strict memoization guards to prevent unintended iframe flashing or data destruction.

---

## 4. Component API

```tsx
// In packages/editor/src/index.tsx
import { TenantEditor } from "@repo/editor";

interface TenantEditorProps {
  /** Design JSON for loading existing templates */
  design?: object | null;
  /** Merge tags (Jinja2 tokens) for the token sidebar */
  mergeTags?: MergeTag[];
  /** Called on save with full responsive HTML + design JSON */
  onSave: (html: string, design: object) => void;
  /** Min height of the editor canvas */
  minHeight?: number | string;
}

interface MergeTag {
  name: string; // Display name: "Customer Name"
  value: string; // Merge tag: "{{ customerName }}"
  sample?: string; // Preview value: "John Doe"
}
```

---

## 5. Component Implementation

**File:** `packages/editor/src/index.tsx`

```tsx
"use client";

import { useCallback, useRef, useMemo } from "react";
import EmailEditor from "react-email-editor";
import type { EditorRef } from "react-email-editor";

interface MergeTag {
  name: string;
  value: string;
  sample?: string;
}

interface TenantEditorProps {
  design?: object | null;
  mergeTags?: MergeTag[];
  onSave: (html: string, design: object) => void;
  minHeight?: number | string;
}

export function TenantEditor({
  design,
  mergeTags = [],
  onSave,
  minHeight = 500,
}: TenantEditorProps) {
  const editorRef = useRef<EditorRef | null>(null);

  // Guard ref to ensure loadDesign only fires exactly once on mount,
  // preventing parent re-renders from wiping active user edits.
  const hasInitializedRef = useRef(false);

  const handleReady = useCallback(() => {
    const editor = editorRef.current?.editor;
    if (!editor || hasInitializedRef.current) return;

    // Lock immediately on first onReady, regardless of whether a
    // design exists. Prevents a late-resolving design prop from
    // re-entering and wiping active user edits on blank templates.
    hasInitializedRef.current = true;

    if (design && Object.keys(design).length > 0) {
      editor.loadDesign(design);
    }
  }, [design]);

  const handleSave = useCallback(() => {
    const editor = editorRef.current?.editor;
    if (!editor) return;

    editor.exportHtml((data) => {
      editor.saveDesign((designData) => {
        onSave(data.html, designData);
      });
    });
  }, [onSave]);

  // Memoize options referentially. Unlayer shallow-compares this object;
  // inline inline arrays would cause the entire iframe engine to re-initialize/flash.
  const memoizedOptions = useMemo(
    () => ({
      displayMode: "email" as const, // Enforces email layout rules over generic web pages
      mergeTags: mergeTags.map((t) => ({
        name: t.name,
        value: t.value,
        sample: t.sample,
      })),
      features: {
        stockImages: false,
        textEditor: { spellcheck: true },
      },
    }),
    [mergeTags],
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <EmailEditor
        ref={editorRef}
        onReady={handleReady}
        minHeight={minHeight}
        options={memoizedOptions}
      />
      <div className="border-t px-3 py-2 flex justify-end bg-muted/20">
        <button
          type="button"
          onClick={handleSave}
          className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Save Template
        </button>
      </div>
    </div>
  );
}
```

---

## 6. Integration into Editor Page

Because Unlayer relies entirely on client-side global window objects, the component must bypass Next.js server-side pre-rendering to prevent hydration mismatches.

**File:** `apps/admin/src/app/(app)/marketing/templates/[id]/page.tsx`

```tsx
"use client";

import dynamic from "next/dynamic";

// Force client-side execution to match internal app patterns (e.g., CurrencySwitcher)
const TenantEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.TenantEditor),
  { ssr: false },
);

export default function TemplatePage() {
  // Assume template data hook/fetcher lives here

  return (
    <TenantEditor
      design={template.body_json}
      mergeTags={[
        {
          name: "Customer Name",
          value: "{{ customerName }}",
          sample: "John Doe",
        },
        { name: "Store URL", value: "{{ storeUrl }}", sample: "https://..." },
        {
          name: "Unsubscribe",
          value: "{{ unsubscribeUrl }}",
          sample: "https://...",
        },
      ]}
      onSave={(html, design) => {
        // Persist to backend mutation
      }}
    />
  );
}
```

---

## 7. Data, Tokens, & Backend Storage

The `CampaignTemplate` model retains its `body_html` (Text) and `body_json` (Text, nullable) schema.

- **Non-Destructive Storage:** The backend must save the full, unaltered output of `body_html` (including `<html>`, `<head>`, and structural `<style>` blocks). This preserves critical responsive layout CSS media queries.
- **Token Constraints:** Users are limited to **single-variable merge tags** (e.g., `{{ customerName }}`) utilizing the sidebar. Complex block-level Jinja2 layout syntax (such as `{% if ... %}`) must not be manually written into text containers, as Unlayer encodes structural HTML characters (converting `<` into `&lt;`), which causes template engine compilation failures.
- **Validation:** Existing `sanitize_tokens()` and `validate_jinja2()` still run against the full string payload.

---

## 8. Risks & Mitigations

| Risk                             | Mitigation                                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSR Hydration Failure**        | Wrapped component is loaded via Next.js `dynamic(..., { ssr: false })` at consumption point.                                                                                                                                                                          |
| **State-Driven Reset Loops**     | `hasInitializedRef` explicitly blocks `loadDesign()` from running more than once on initial mount, preserving un-saved user input.                                                                                                                                    |
| **Iframe Reloading/Flashing**    | `memoizedOptions` stabilizes the options object referentially across parent render ticks.                                                                                                                                                                             |
| **Destructive Data Stripping**   | Saving full outer markup tags instead of regex stripping on save retains responsive email device scaling.                                                                                                                                                             |
| **Token Compilation Crashes**    | Enforced string restrictions to variable-only merge tags, sidestepping Unlayer's native HTML encoding of structural logic blocks (`{% %}`).                                                                                                                           |
| **SaaS/External Dependencies**   | Explicit infrastructure requirement defined: Application must have external network visibility to communicate with `editor.unlayer.com`.                                                                                                                              |
| **Stale onReady Callbacks**      | If the component unmounts before the iframe boots, `handleReady` could fire against a detached ref. The `hasInitializedRef` guard and ref-based editor access naturally prevent this — `editorRef.current` will be `null` post-unmount, so `handleReady` exits early. |
| **Premium Element Interception** | Unlayer free tier displays premium modules. If users pull paid items into layout, scope explicit `blocks` arrays in config options to restrict allowed canvas elements.                                                                                               |

---

## 9. Files Changed

| File                                   | Change                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/editor/src/index.tsx`        | **Rewrite** — Implement declarative, client-safe wrapper with initialization ref locks. |
| `apps/admin/package.json`              | Remove old `@react-email/editor` direct dependencies.                                   |
| `apps/admin/src/app/.../[id]/page.tsx` | Replace textarea engine with dynamic client-side `<TenantEditor/>`.                     |
