"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { BoldIcon, ItalicIcon, ListIcon } from "lucide-react";

interface TenantEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  tenantId?: string;
}

function MenuBar({ editor }: { editor: any }) {
  if (!editor) return null;

  const btn = (
    active: boolean,
    onPress: () => void,
    label: string,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={onPress}
      className={`rounded p-1.5 transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 border-b px-3 py-2">
      {btn(
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        "Bold",
        <BoldIcon className="h-4 w-4" />,
      )}
      {btn(
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        "Italic",
        <ItalicIcon className="h-4 w-4" />,
      )}
      {btn(
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        "Bullet List",
        <ListIcon className="h-4 w-4" />,
      )}
    </div>
  );
}

export function TenantEditor({
  initialContent = "",
  onChange,
}: TenantEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Press '/' for commands, or write product description...",
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "focus:outline-none min-h-[160px] px-3 py-2 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic",
      },
    },
  });

  const handleAIComplete = async () => {
    if (!editor) return;
    const currentText = editor.getText();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentText }),
      });
      const data = await res.json();
      if (data.completion) {
        editor.commands.insertContent(data.completion);
      }
    } catch {
      // silently fail — AI is optional
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/30">
        <MenuBar editor={editor} />
        <button
          type="button"
          onClick={handleAIComplete}
          className="mr-2 flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
            <path d="M19 17l-1 3 3-1-3 1 1-3z" />
          </svg>{" "}
          Ask AI
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
