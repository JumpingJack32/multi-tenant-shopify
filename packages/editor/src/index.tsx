"use client";

import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  CodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
  LinkIcon,
  WandIcon,
} from "lucide-react";

interface TenantEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
}

export function TenantEditor({
  initialContent = "",
  onChange,
}: TenantEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { HTMLAttributes: { class: "list-disc pl-4" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-4" } },
      }),
      Placeholder.configure({ placeholder: "Type / for commands..." }),
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert focus:outline-none min-h-[200px] max-w-none px-4 py-3",
      },
    },
  });

  if (!editor) return null;

  const toggleLink = () => {
    const url = editor.getAttributes("link").href;
    if (url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = prompt("Enter URL:");
      if (href) editor.chain().focus().setLink({ href }).run();
    }
  };

  const handleAI = async () => {
    const text = editor.getText();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      if (data.completion) {
        editor.commands.insertContent(data.completion);
      }
    } catch {
      // silently fail
    }
  };

  const ToolBtn = ({
    active,
    onClick,
    title,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b px-2 py-1.5 bg-muted/30 flex-wrap">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <BoldIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <ItalicIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <StrikethroughIcon className="h-4 w-4" />
        </ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <ListIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <ListOrderedIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <QuoteIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
        >
          <CodeIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("link")}
          onClick={toggleLink}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolBtn active={false} onClick={handleAI} title="Ask AI to complete">
          <WandIcon className="h-4 w-4" />
        </ToolBtn>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Bubble menu on selection */}
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
          <div className="flex items-center gap-0.5 rounded-lg border bg-background px-1.5 py-1 shadow-lg">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`rounded p-1 ${editor.isActive("bold") ? "text-blue-500" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BoldIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`rounded p-1 ${editor.isActive("italic") ? "text-blue-500" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ItalicIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`rounded p-1 ${editor.isActive("underline") ? "text-blue-500" : "text-muted-foreground hover:text-foreground"}`}
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </BubbleMenu>
      )}
    </div>
  );
}
