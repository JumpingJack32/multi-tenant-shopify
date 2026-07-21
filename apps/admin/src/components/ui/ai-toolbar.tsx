"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AIToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

type Action = "fix_grammar" | "make_engaging" | "shorten" | "expand";

export function AIToolbar({ textareaRef }: AIToolbarProps) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingOutput, setStreamingOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bufferRef = useRef("");

  const handleSelectionChange = useCallback(() => {
    if (isGenerating) return;

    const textarea = textareaRef.current;
    if (!textarea || document.activeElement !== textarea) {
      setPosition(null);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      setPosition(null);
      return;
    }

    const text = textarea.value.slice(start, end);
    setSelectedText(text);
    setSelectionRange({ start, end });

    // Position the toolbar above the selection
    const rect = textarea.getBoundingClientRect();
    const lineHeight = 20;
    const linesAbove = textarea.value.slice(0, start).split("\n").length;
    const top = rect.top + linesAbove * lineHeight;

    // Clamp: if too close to viewport top, render below instead
    const spaceAbove = top - 10;
    const toolbarTop = spaceAbove < 48 ? top + lineHeight : top - 40;

    setPosition({
      top: toolbarTop,
      left: rect.left + rect.width / 2,
    });
  }, [isGenerating, textareaRef]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  const handleAction = useCallback(
    async (action: Action) => {
      if (!selectedText || !selectionRange || !textareaRef.current) return;

      setIsGenerating(true);
      setStreamingOutput("");
      setError(null);
      bufferRef.current = "";

      const textarea = textareaRef.current;

      try {
        const res = await fetch("/api/v1/ai/transform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: selectedText, action }),
        });

        if (!res.ok) throw new Error("Transform failed");

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let isFirstChunk = true;

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const content = line.slice(6);
              if (content === "[DONE]") break;
              bufferRef.current += content;

              if (isFirstChunk) {
                // First chunk: replace the selection
                textarea.setSelectionRange(
                  selectionRange.start,
                  selectionRange.end,
                );
                document.execCommand("insertText", false, bufferRef.current);
                isFirstChunk = false;
              } else {
                // Subsequent chunks: replace the growing text
                const currentEnd =
                  selectionRange.start +
                  bufferRef.current.length -
                  content.length;
                textarea.setSelectionRange(
                  currentEnd,
                  currentEnd + content.length,
                );
                document.execCommand("insertText", false, content);
              }

              setStreamingOutput(bufferRef.current);
            } else if (line.startsWith("event: error")) {
              throw new Error("AI transformation error");
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transform failed");
      } finally {
        setIsGenerating(false);
      }
    },
    [selectedText, selectionRange, textareaRef],
  );

  const handleAccept = useCallback(() => {
    setStreamingOutput("");
    setPosition(null);
    setError(null);
  }, []);

  const handleReject = useCallback(() => {
    if (textareaRef.current && selectionRange) {
      // Revert by re-inserting original text
      textareaRef.current.setSelectionRange(
        selectionRange.start,
        selectionRange.start + bufferRef.current.length,
      );
      document.execCommand("insertText", false, selectedText);
    }
    setStreamingOutput("");
    setPosition(null);
    setError(null);
  }, [textareaRef, selectionRange, selectedText]);

  if (!position) return null;

  const actions: { key: Action; label: string }[] = [
    { key: "fix_grammar", label: "Fix Grammar" },
    { key: "make_engaging", label: "Make Engaging" },
    { key: "shorten", label: "Shorten" },
    { key: "expand", label: "Expand" },
  ];

  return (
    <div
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="fixed z-50 -translate-x-1/2 flex items-center gap-1 rounded-lg border bg-popover px-2 py-1.5 shadow-md text-xs"
      onMouseDown={(e) => e.preventDefault()}
    >
      {!streamingOutput && !error && (
        <>
          <svg
            viewBox="0 0 65 65"
            fill="none"
            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
          >
            <path
              d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z"
              fill="currentColor"
            />
          </svg>
          {actions.map((a) => (
            <button
              key={a.key}
              onClick={() => handleAction(a.key)}
              disabled={isGenerating}
              className="px-2 py-0.5 rounded hover:bg-accent transition-colors disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </>
      )}
      {isGenerating && (
        <span className="text-muted-foreground animate-pulse">
          Generating...
        </span>
      )}
      {streamingOutput && !isGenerating && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleAccept}
            className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="px-2 py-0.5 rounded hover:bg-accent transition-colors text-xs"
          >
            Revert
          </button>
        </div>
      )}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
