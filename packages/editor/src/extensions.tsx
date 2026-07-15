import {
  TiptapImage,
  TiptapLink,
  UpdatedImage,
  TaskList,
  TaskItem,
  HorizontalRule,
  StarterKit,
  Placeholder,
  AIHighlight,
  UploadImagesPlugin,
} from "novel";

const aiHighlight = AIHighlight;
const placeholder = Placeholder.configure({
  placeholder: "Press '/' for commands and start making changes...",
});

const tiptapLink = TiptapLink.configure({
  HTMLAttributes: {
    class:
      "text-muted-foreground underline underline-offset-[3px] hover:text-primary transition-colors cursor-pointer",
  },
});

const tiptapImage = TiptapImage.extend({
  addProseMirrorPlugins() {
    return [
      UploadImagesPlugin({
        imageClass: "opacity-40 rounded-lg border border-stone-200",
      }),
    ];
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: { class: "rounded-lg border border-muted" },
});

const updatedImage = UpdatedImage.configure({
  HTMLAttributes: { class: "rounded-lg border border-muted" },
});

const taskList = TaskList.configure({
  HTMLAttributes: { class: "not-prose pl-2" },
});

const taskItem = TaskItem.configure({
  HTMLAttributes: { class: "flex gap-2 items-start my-4" },
  nested: true,
});

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: { class: "mt-4 mb-6 border-t border-muted-foreground" },
});

const starterKit = StarterKit.configure({
  bulletList: {
    HTMLAttributes: { class: "list-disc list-outside leading-3 -mt-2" },
  },
  orderedList: {
    HTMLAttributes: { class: "list-decimal list-outside leading-3 -mt-2" },
  },
  listItem: { HTMLAttributes: { class: "leading-normal -mb-2" } },
  blockquote: { HTMLAttributes: { class: "border-l-4 border-primary" } },
  codeBlock: {
    HTMLAttributes: {
      class:
        "rounded-md bg-muted text-muted-foreground border p-5 font-mono font-medium",
    },
  },
  code: {
    HTMLAttributes: {
      class: "rounded-md bg-muted px-1.5 py-1 font-mono font-medium",
      spellcheck: "false",
    },
  },
  horizontalRule: false,
  dropcursor: { color: "#DBEAFE", width: 4 },
  gapcursor: false,
});

export const defaultExtensions: any[] = [
  starterKit,
  placeholder,
  tiptapLink,
  tiptapImage,
  updatedImage,
  taskList,
  taskItem,
  horizontalRule,
  aiHighlight,
];
