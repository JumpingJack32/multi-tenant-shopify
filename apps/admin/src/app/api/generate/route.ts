import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Optional: connect to local Ollama instance for AI-powered product descriptions.
    // To enable, install Ollama (https://ollama.ai) and pull a model:
    //   ollama pull qwen2.5:7b
    //
    // Then uncomment below and set OLLAMA_URL env var:
    /*
    const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
        messages: [
          {
            role: "system",
            content: "You are an expert copywriter helping an ecommerce merchant write compelling product descriptions. Keep responses concise and ready to use.",
          },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const data = await res.json();
    const completion = data.choices?.[0]?.message?.content;

    if (completion) {
      return NextResponse.json({ completion });
    }
    */

    // Fallback: no AI configured
    return NextResponse.json({
      completion:
        "\n\n" +
        "Crafted from premium materials, this product combines timeless design with modern functionality. " +
        "Perfect for everyday use, it offers exceptional comfort and durability. " +
        "Available in a range of sizes to suit your needs.",
    });
  } catch {
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 },
    );
  }
}
