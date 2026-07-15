"use client";

import { useState, useCallback, useRef } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import * as Popover from "@radix-ui/react-popover";
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  StrikethroughIcon,
  TypeIcon,
  UnderlineIcon,
} from "lucide-react";

interface TenantEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
}

interface ToolbarButtonProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md";
}

const headingLevels = [
  { level: null as number | null, label: "Paragraph", icon: TypeIcon },
  { level: 1, label: "Heading 1", icon: Heading1Icon },
  { level: 2, label: "Heading 2", icon: Heading2Icon },
  { level: 3, label: "Heading 3", icon: Heading3Icon },
  { level: 4, label: "Heading 4", icon: Heading4Icon },
];

const GeminiIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 65 65"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z"
      fill="currentColor"
    />
  </svg>
);

function ToolbarButton({
  active,
  disabled = false,
  onClick,
  title,
  children,
  size = "md",
}: ToolbarButtonProps) {
  const sizeClasses = size === "sm" ? "p-1" : "p-1.5";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`rounded transition-colors ${sizeClasses} ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}

export function TenantEditor({
  initialContent = "",
  onChange,
}: TenantEditorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<
    "idle" | "loading" | "no-text" | "error"
  >("idle");
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showFeedback = (state: "no-text" | "error") => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(state);
    feedbackTimer.current = setTimeout(() => setFeedback("idle"), 2000);
  };

  const handleAI = useCallback(async () => {
    if (!editor) return;

    const selectionText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      " ",
    );
    const textToProcess = selectionText || editor.getText();

    if (!textToProcess.trim()) {
      showFeedback("no-text");
      return;
    }

    setIsGenerating(true);
    setFeedback("loading");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToProcess }),
      });
      const data = await res.json();
      if (data.completion) {
        editor.chain().focus().insertContent(data.completion).run();
      }
      setFeedback("idle");
    } catch {
      showFeedback("error");
    } finally {
      setIsGenerating(false);
    }
  }, [editor]);

  if (!editor) return null;

  const getActiveHeading = (): (typeof headingLevels)[number] => {
    for (const h of headingLevels) {
      if (
        h.level &&
        editor.isActive("heading", { level: h.level as 1 | 2 | 3 | 4 | 5 | 6 })
      )
        return h;
    }
    return headingLevels[0]!;
  };

  const activeHeading = getActiveHeading();
  const { icon: ActiveIcon, level: activeLevel } = activeHeading;

  const toggleLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    if (previousUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = prompt("Enter URL:");
    if (href === null) return;
    if (href === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href }).run();
  };

  const aiTitle = () => {
    switch (feedback) {
      case "loading":
        return "Generating...";
      case "no-text":
        return "No text to process";
      case "error":
        return "Generation failed";
      default:
        return "Ask AI to complete";
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b px-2 py-1.5 bg-muted/30 flex-wrap">
        {/* Heading Dropdown */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              title="Heading"
              className="flex items-center gap-1 rounded p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-sm min-w-[36px]"
            >
              <ActiveIcon className="h-4 w-4" />
              <ChevronDownIcon className="h-3 w-3" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={4}
              align="start"
              className="z-50 rounded-lg border bg-popover p-1 shadow-md"
            >
              {headingLevels.map((h) => {
                const Icon = h.icon;
                const isActive = h.level === activeLevel;
                return (
                  <button
                    key={h.label}
                    type="button"
                    onClick={() => {
                      if (h.level) {
                        editor
                          .chain()
                          .focus()
                          .toggleHeading({
                            level: h.level as 1 | 2 | 3 | 4 | 5 | 6,
                          })
                          .run();
                      } else {
                        editor.chain().focus().setParagraph().run();
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {h.label}
                  </button>
                );
              })}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <BoldIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <ItalicIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <StrikethroughIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <ListIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <ListOrderedIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <QuoteIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
        >
          <CodeIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("link")}
          onClick={toggleLink}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* AI button — far right */}
        <div className="ml-auto flex items-center">
          <ToolbarDivider />
          <button
            type="button"
            onClick={handleAI}
            disabled={isGenerating}
            title={aiTitle()}
            className={`rounded p-1.5 transition-colors ${
              feedback === "no-text"
                ? "text-amber-500 animate-[shake_0.3s_ease-in-out]"
                : feedback === "error"
                  ? "text-destructive"
                  : feedback === "loading"
                    ? "text-blue-500"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            } ${isGenerating ? "opacity-50" : "cursor-pointer"}`}
          >
            <GeminiIcon
              className={`h-4 w-4 ${feedback === "loading" ? "animate-pulse" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <EditorContent editor={editor} />

      {/* Bubble menu on selection */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
        <div className="flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-lg">
          <ToolbarButton
            size="sm"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <BoldIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            size="sm"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <ItalicIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            size="sm"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      </BubbleMenu>
    </div>
  );
}
