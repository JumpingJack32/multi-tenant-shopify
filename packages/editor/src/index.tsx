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

  const hasInitializedRef = useRef(false);

  const handleReady = useCallback(() => {
    const editor = editorRef.current?.editor;
    if (!editor || hasInitializedRef.current) return;

    hasInitializedRef.current = true;

    if (design && Object.keys(design).length > 0) {
      editor.loadDesign(design as Parameters<typeof editor.loadDesign>[0]);
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

  const memoizedOptions = useMemo(
    () =>
      ({
        displayMode: "email" as const,
        mergeTags: Object.fromEntries(
          mergeTags.map((t) => [
            t.value,
            { name: t.name, value: t.value, sample: t.sample || undefined },
          ]),
        ),
        features: {
          stockImages: false,
          textEditor: { spellChecker: true },
        },
      }) as const,
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
