"use client";

import { useState } from "react";
import {
  EditorRoot,
  EditorCommand,
  EditorCommandItem,
  EditorCommandEmpty,
  EditorContent,
  EditorCommandList,
  EditorBubble,
} from "novel";
import { ImageResizer, handleCommandNavigation } from "novel/extensions";
import { handleImageDrop, handleImagePaste } from "novel/plugins";
import { defaultExtensions } from "./extensions";
import { slashCommand, suggestionItems } from "./slash-command";
import { uploadFn } from "./image-upload";

const extensions = [...defaultExtensions, slashCommand];

interface TenantEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
}

export function TenantEditor({
  initialContent = "",
  onChange,
}: TenantEditorProps) {
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openLink, setOpenLink] = useState(false);

  return (
    <EditorRoot>
      <EditorContent
        className="border p-4 rounded-xl"
        initialContent={initialContent as any}
        extensions={extensions}
        editorProps={{
          handleDOMEvents: {
            keydown: (_view, event) => handleCommandNavigation(event),
          },
          handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
          handleDrop: (view, event, _slice, moved) =>
            handleImageDrop(view, event, moved, uploadFn),
          attributes: {
            class:
              "prose prose-sm dark:prose-invert focus:outline-none max-w-full",
          },
        }}
        onUpdate={({ editor }) => {
          onChange(editor.getHTML());
        }}
        slotAfter={<ImageResizer />}
      >
        <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md transition-all">
          <EditorCommandEmpty className="px-2 text-muted-foreground">
            No results
          </EditorCommandEmpty>
          <EditorCommandList>
            {suggestionItems.map((item: any) => (
              <EditorCommandItem
                value={item.title}
                onCommand={(val) => item.command?.(val)}
                className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent"
                key={item.title}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-muted bg-background">
                  {item.icon}
                </div>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </EditorCommandItem>
            ))}
          </EditorCommandList>
        </EditorCommand>

        <EditorBubble
          tippyOptions={{ placement: "top" }}
          className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl"
        >
          <NodeSelector open={openNode} onOpenChange={setOpenNode} />
          <LinkSelector open={openLink} onOpenChange={setOpenLink} />
          <TextButtons />
          <ColorSelector open={openColor} onOpenChange={setOpenColor} />
        </EditorBubble>
      </EditorContent>
    </EditorRoot>
  );
}

// ─── Bubble menu sub-components ─────────────────────────────────────

import {
  BoldIcon,
  Check,
  CheckSquare,
  ChevronDown,
  Code,
  CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  ItalicIcon,
  ListOrdered,
  Quote,
  StrikethroughIcon,
  TextIcon,
  Trash,
  UnderlineIcon,
} from "lucide-react";
import { EditorBubbleItem, useEditor, type EditorInstance } from "novel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import { Button } from "./button";
import { cn } from "./cn";

type SelectorItem = {
  name: string;
  icon: any;
  command: (editor: EditorInstance) => void;
  isActive: (editor: EditorInstance) => boolean;
};

const nodeItems: SelectorItem[] = [
  {
    name: "Text",
    icon: TextIcon,
    command: (editor) => editor.chain().focus().clearNodes().run(),
    isActive: (editor) =>
      editor.isActive("paragraph") &&
      !editor.isActive("bulletList") &&
      !editor.isActive("orderedList"),
  },
  {
    name: "Heading 1",
    icon: Heading1,
    command: (editor) =>
      editor.chain().focus().clearNodes().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
  },
  {
    name: "Heading 2",
    icon: Heading2,
    command: (editor) =>
      editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    name: "Heading 3",
    icon: Heading3,
    command: (editor) =>
      editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
  },
  {
    name: "To-do List",
    icon: CheckSquare,
    command: (editor) =>
      editor.chain().focus().clearNodes().toggleTaskList().run(),
    isActive: (editor) => editor.isActive("taskItem"),
  },
  {
    name: "Bullet List",
    icon: ListOrdered,
    command: (editor) =>
      editor.chain().focus().clearNodes().toggleBulletList().run(),
    isActive: (editor) => editor.isActive("bulletList"),
  },
  {
    name: "Numbered List",
    icon: ListOrdered,
    command: (editor) =>
      editor.chain().focus().clearNodes().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive("orderedList"),
  },
  {
    name: "Quote",
    icon: Quote,
    command: (editor) =>
      editor.chain().focus().clearNodes().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive("blockquote"),
  },
  {
    name: "Code",
    icon: Code,
    command: (editor) =>
      editor.chain().focus().clearNodes().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive("codeBlock"),
  },
];

function NodeSelector({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { editor } = useEditor();
  if (!editor) return null;
  const activeItem = nodeItems
    .filter((item) => item.isActive(editor))
    .pop() ?? { name: "Multiple" };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 rounded-none border-none"
        >
          <span className="whitespace-nowrap text-sm">{activeItem.name}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        sideOffset={5}
        align="start"
        className="w-48 p-1 bg-background border rounded-md shadow-md"
      >
        {nodeItems.map((item, index) => (
          <EditorBubbleItem
            key={index}
            onSelect={(editor) => {
              item.command(editor);
              onOpenChange(false);
            }}
            className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-sm hover:bg-accent"
          >
            <div className="flex items-center space-x-2">
              <div className="rounded-sm border p-1">
                <item.icon className="h-3 w-3" />
              </div>
              <span>{item.name}</span>
            </div>
            {activeItem.name === item.name && <Check className="h-4 w-4" />}
          </EditorBubbleItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function LinkSelector({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { editor } = useEditor();
  if (!editor) return null;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 rounded-none border-none"
        >
          <span className="text-base">↗</span>
          <span
            className={cn(
              "underline underline-offset-4",
              editor.isActive("link") && "text-blue-500",
            )}
          >
            Link
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-60 p-0 bg-background border rounded-md shadow-md"
        sideOffset={10}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (
              e.currentTarget as HTMLFormElement
            )[0] as HTMLInputElement;
            const url = input.value;
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className="flex p-1"
        >
          <input
            type="text"
            placeholder="Paste a link"
            className="flex-1 bg-background p-1 text-sm outline-none"
            defaultValue={editor.getAttributes("link").href || ""}
          />
          {editor.getAttributes("link").href ? (
            <Button
              size="icon"
              variant="outline"
              type="button"
              className="h-8 text-red-600"
              onClick={() => editor.chain().focus().unsetLink().run()}
            >
              <Trash className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" className="h-8">
              <Check className="h-4 w-4" />
            </Button>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
}

function TextButtons() {
  const { editor } = useEditor();
  if (!editor) return null;
  const items: SelectorItem[] = [
    {
      name: "bold",
      isActive: (e) => e.isActive("bold"),
      command: (e) => e.chain().focus().toggleBold().run(),
      icon: BoldIcon,
    },
    {
      name: "italic",
      isActive: (e) => e.isActive("italic"),
      command: (e) => e.chain().focus().toggleItalic().run(),
      icon: ItalicIcon,
    },
    {
      name: "underline",
      isActive: (e) => e.isActive("underline"),
      command: (e) => e.chain().focus().toggleUnderline().run(),
      icon: UnderlineIcon,
    },
    {
      name: "strike",
      isActive: (e) => e.isActive("strike"),
      command: (e) => e.chain().focus().toggleStrike().run(),
      icon: StrikethroughIcon,
    },
    {
      name: "code",
      isActive: (e) => e.isActive("code"),
      command: (e) => e.chain().focus().toggleCode().run(),
      icon: CodeIcon,
    },
  ];
  return (
    <div className="flex">
      {items.map((item, i) => (
        <EditorBubbleItem key={i} onSelect={(editor) => item.command(editor)}>
          <Button
            type="button"
            size="sm"
            className="rounded-none"
            variant="ghost"
          >
            <item.icon
              className={cn(
                "h-4 w-4",
                item.isActive(editor) && "text-blue-500",
              )}
            />
          </Button>
        </EditorBubbleItem>
      ))}
    </div>
  );
}

const TEXT_COLORS = [
  { name: "Default", color: "var(--novel-black)" },
  { name: "Purple", color: "#9333EA" },
  { name: "Red", color: "#E00000" },
  { name: "Blue", color: "#2563EB" },
  { name: "Green", color: "#008A00" },
  { name: "Orange", color: "#FFA500" },
];

function ColorSelector({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { editor } = useEditor();
  if (!editor) return null;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-2 rounded-none" variant="ghost">
          <span
            className="rounded-sm px-1"
            style={{
              color: TEXT_COLORS.find((c) =>
                editor.isActive("textStyle", { color: c.color }),
              )?.color,
            }}
          >
            A
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        sideOffset={5}
        className="w-48 p-1 bg-background border rounded-md shadow-md"
        align="start"
      >
        <div className="text-sm font-semibold text-muted-foreground px-2 py-1">
          Color
        </div>
        {TEXT_COLORS.map(({ name, color }) => (
          <EditorBubbleItem
            key={name}
            onSelect={() => {
              editor.commands.unsetColor();
              if (name !== "Default")
                editor.chain().focus().setColor(color).run();
            }}
            className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-accent"
          >
            <div
              className="rounded-sm border px-2 py-px font-medium"
              style={{ color }}
            >
              A
            </div>
            <span>{name}</span>
          </EditorBubbleItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}
