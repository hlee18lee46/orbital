
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `
You are Orbit AI, the friendly science assistant inside
Orbital Gravity, an educational 3D planetary simulator.

Help players understand meteoroids, meteors, meteorites,
impacts, craters, gravity, atmospheres, and NASA observations.

Default experiment:
- Destination: Moon
- Meteoroid diameter: 2 meters
- Speed: 20 km/s
- Impact angle: 45 degrees
- Assumed density: 3000 kg/m³

Explain physics clearly and accurately.
Distinguish actual NASA observations from hypothetical
simulations. Do not invent NASA measurements.
Crater size requires additional physical assumptions.
Keep responses concise and educational.
`.trim();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function callVultr(
  message: string,
  history: ChatMessage[],
  context: string
): Promise<string> {
  const key = process.env.VULTR_INFERENCE_API_KEY?.trim();

  if (!key) throw new Error("Vultr API key missing");

  const response = await fetch(
    "https://api.vultrinference.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.VULTR_AI_MODEL ||
          "deepseek-v4.1-flash",
        messages: [
          {
            role: "system",
            content: `${SYSTEM_PROMPT}\n${context}`,
          },
          ...history,
          { role: "user", content: message },
        ],
        max_completion_tokens: 1024,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Vultr HTTP ${response.status}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) throw new Error("Empty Vultr response");

  return reply;
}

async function callGemini(
  message: string,
  history: ChatMessage[],
  context: string
): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();

  if (!key) throw new Error("GEMINI_API_KEY is missing");

  const model =
    process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const contents = [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    })),
    {
      role: "user",
      parts: [{ text: message }],
    },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n${context}`,
            },
          ],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.6,
        },
      }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }

  const data = await response.json();

  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!reply) throw new Error("Empty Gemini response");

  return reply;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message || message.length > 2000) {
      return NextResponse.json(
        { error: "Message must be 1–2000 characters" },
        { status: 400 }
      );
    }

    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (item: unknown): item is ChatMessage =>
              typeof item === "object" &&
              item !== null &&
              "role" in item &&
              "content" in item &&
              (item.role === "user" ||
                item.role === "assistant") &&
              typeof item.content === "string"
          )
          .slice(-10)
          .map((item: ChatMessage) => ({
            role: item.role,
            content: item.content.slice(0, 2000),
          }))
      : [];

    const planet = String(
      body.planet || body.world || "Moon"
    ).slice(0, 50);

    const context = `
Current selected planet: ${planet}.
Meteor experiment settings:
${JSON.stringify(body.meteor || {}, null, 2).slice(0, 1000)}
`;

    const provider = (
      process.env.AI_PROVIDER || "auto"
    ).toLowerCase();

    let reply: string;
    let usedProvider: "vultr" | "gemini";

    if (provider === "gemini") {
      reply = await callGemini(message, history, context);
      usedProvider = "gemini";
    } else if (provider === "vultr") {
      reply = await callVultr(message, history, context);
      usedProvider = "vultr";
    } else {
      try {
        reply = await callVultr(message, history, context);
        usedProvider = "vultr";
      } catch (error) {
        console.warn(
          "Vultr unavailable, falling back to Gemini:",
          errorMessage(error)
        );

        reply = await callGemini(message, history, context);
        usedProvider = "gemini";
      }
    }

    return NextResponse.json({
      reply,
      provider: usedProvider,
    });
  } catch (error) {
    console.error("Meteor chat error:", errorMessage(error));

    return NextResponse.json(
      { error: "AI chat is temporarily unavailable" },
      { status: 502 }
    );
  }
}
