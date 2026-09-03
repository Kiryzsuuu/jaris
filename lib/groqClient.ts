const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

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
