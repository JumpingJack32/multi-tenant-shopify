"use client";

import { EditorContent, EditorRoot } from "novel";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

interface TenantEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
}

export function TenantEditor({
  initialContent = "",
  onChange,
}: TenantEditorProps) {
  return (
    <EditorRoot>
      <EditorContent
        className="border p-4 rounded-xl"
        initialContent={initialContent as any}
        extensions={[
          StarterKit,
          Placeholder.configure({
            placeholder: "Press '/' for commands and start making changes...",
          }),
        ]}
        editorProps={{
          attributes: {
            class:
              "prose prose-sm dark:prose-invert focus:outline-none max-w-full min-h-[160px]",
          },
        }}
        onUpdate={({ editor }) => {
          onChange(editor.getHTML());
        }}
      />
    </EditorRoot>
  );
}
