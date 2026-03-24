/**
 * Low-level OpenAI / Gemini chat completion.
 * Prefer `runEnkryptLlm` from `enkryptLlmApi.ts` in product panels so all text features share one entry point.
 */

/**
 * Model IDs for this app — use each vendor’s current default chat models.
 * OpenAI: `gpt-4o` tracks the flagship 4o line; Gemini: `gemini-2.5-flash` (see Google AI docs).
 */
export const ENKRYPT_OPENAI_CHAT_MODEL = "gpt-4o";
/** Cheaper OpenAI calls (e.g. Studio helpers) — still on the current 4o-mini line. */
export const ENKRYPT_OPENAI_FAST_MODEL = "gpt-4o-mini";
export const ENKRYPT_GEMINI_CHAT_MODEL = "gemini-2.5-flash";

/** Gemini `generateContent` URL for the configured chat model. */
export function enkryptGeminiGenerateUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${ENKRYPT_GEMINI_CHAT_MODEL}:generateContent?key=${apiKey}`;
}

export type CompleteTextOptions = {
  /** OpenAI: max_tokens. Gemini: maxOutputTokens. Capped per provider. */
  maxOutputTokens?: number;
  /** Override default 0.7 (e.g. lower for JSON). */
  temperature?: number;
  /** OpenAI only: force JSON object output (system/user must mention JSON). */
  responseFormatJson?: boolean;
};

export async function completeText(
  apiKeyRaw: string,
  provider: "openai" | "gemini",
  systemPrompt: string,
  userPrompt: string,
  options?: CompleteTextOptions,
): Promise<string> {
  const apiKey = apiKeyRaw.replace(/[^\x20-\x7E]/g, "").trim();
  if (!apiKey) throw new Error("Configure your API key in Settings.");

  const want = options?.maxOutputTokens ?? 8192;
  const openAiMax = Math.min(Math.max(want, 256), 16384);
  const geminiMax = Math.min(Math.max(want, 256), 8192);
  const temperature =
    typeof options?.temperature === "number" ? Math.min(Math.max(options.temperature, 0), 2) : 0.7;

  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ENKRYPT_OPENAI_CHAT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: openAiMax,
        ...(options?.responseFormatJson ? { response_format: { type: "json_object" as const } } : {}),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI error ${response.status}`);
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty response from OpenAI");
    return text.trim();
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ENKRYPT_GEMINI_CHAT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature, maxOutputTokens: geminiMax },
      }),
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini error ${response.status}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text.trim();
}
