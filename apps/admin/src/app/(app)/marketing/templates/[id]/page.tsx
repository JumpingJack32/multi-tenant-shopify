"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";

const TOKENS = [
  "{{ customerName }}",
  "{{ segmentName }}",
  "{{ storeUrl }}",
  "{{ offerHtml | safe }}",
];

export default function TemplateEditorPage() {
  const router = useRouter();
  const [html, setHtml] = useState("<p>Start designing your email...</p>");

  const insertToken = (token: string) => {
    setHtml((prev) => prev + token);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={() => router.push("/marketing/templates")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Templates
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Preview
          </Button>
          <Button size="sm">Save Template</Button>
        </div>
      </div>
      <div className="flex flex-1 gap-4 p-4">
        <div className="flex-1">
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="h-full min-h-[400px] font-mono text-sm"
          />
        </div>
        <div className="w-48 space-y-2">
          <h3 className="text-sm font-medium">Tokens</h3>
          {TOKENS.map((token) => (
            <Button
              key={token}
              variant="outline"
              size="sm"
              className="w-full justify-start font-mono text-xs"
              onClick={() => insertToken(token)}
            >
              {token}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
