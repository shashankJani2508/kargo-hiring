// Minimal Gemini REST client (generateContent) with JSON output and retries.

const BASE = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

interface Options {
  system?: string;
  schema?: object;
  thinking?: "minimal" | "low" | "medium" | "high";
  maxOutputTokens?: number;
}

export async function generateJson<T>(parts: Part[], opts: Options = {}): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      ...(opts.schema ? { responseSchema: opts.schema } : {}),
      ...(opts.thinking ? { thinkingConfig: { thinkingLevel: opts.thinking } } : {}),
      maxOutputTokens: opts.maxOutputTokens ?? 16384,
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${json?.error?.message ?? "request failed"}`);
      const text: string = (json?.candidates?.[0]?.content?.parts ?? [])
        .filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === "string")
        .map((p: { text: string }) => p.text)
        .join("");
      if (!text) {
        const reason = json?.candidates?.[0]?.finishReason ?? json?.promptFeedback?.blockReason ?? "empty";
        throw new RetryableError(`Gemini returned no content (${reason})`);
      }
      return parseJson<T>(text);
    } catch (e) {
      lastErr = e;
      if (!(e instanceof RetryableError) && !(e instanceof SyntaxError) && !(e instanceof TypeError)) throw e;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

class RetryableError extends Error {}

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(cleaned) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
