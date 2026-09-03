const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export class GroqError extends Error {}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function groqChatCompletion(
  messages: GroqMessage[],
  options?: { temperature?: number; jsonMode?: boolean }
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqError("GROQ_API_KEY environment variable is not defined");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
      messages,
      temperature: options?.temperature ?? 0.2,
      ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GroqError(`Groq API error: ${response.status} ${body}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new GroqError("Groq API returned an unexpected response shape");
  }
  return content;
}

/**
 * Vision (multimodal) completion - sends one image plus a text prompt to a
 * vision-capable Groq model. Used for the damage-photo analysis suggestion
 * (never writes anything to a claim by itself - it's advisory only).
 */
export async function groqVisionCompletion(params: {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  jsonMode?: boolean;
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqError("GROQ_API_KEY environment variable is not defined");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_VISION_MODEL ?? DEFAULT_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: params.prompt },
            {
              type: "image_url",
              image_url: { url: `data:${params.mimeType};base64,${params.imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0.2,
      ...(params.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GroqError(`Groq vision API error: ${response.status} ${body}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new GroqError("Groq vision API returned an unexpected response shape");
  }
  return content;
}
