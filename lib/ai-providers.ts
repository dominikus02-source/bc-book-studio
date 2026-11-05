import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { db } from "./db";

export const PROVIDERS = {
  deepseek: { label: "DeepSeek", exampleModel: "deepseek-flash", endpoint: "https://api.deepseek.com/chat/completions", protocol: "chat" },
  openai: { label: "OpenAI", exampleModel: "gpt-4.1-mini", endpoint: "https://api.openai.com/v1/chat/completions", protocol: "chat" },
  groq: { label: "Groq", exampleModel: "openai/gpt-oss-120b", endpoint: "https://api.groq.com/openai/v1/chat/completions", protocol: "chat" },
  gemini: { label: "Google Gemini", exampleModel: "gemini-2.5-flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", protocol: "gemini" },
  anthropic: { label: "Anthropic Claude", exampleModel: "claude-sonnet-4-5", endpoint: "https://api.anthropic.com/v1/messages", protocol: "anthropic" },
  openrouter: { label: "OpenRouter", exampleModel: "openai/gpt-4.1-mini", endpoint: "https://openrouter.ai/api/v1/chat/completions", protocol: "chat" },
  mistral: { label: "Mistral AI", exampleModel: "mistral-small-latest", endpoint: "https://api.mistral.ai/v1/chat/completions", protocol: "chat" },
  xai: { label: "xAI Grok", exampleModel: "grok-4", endpoint: "https://api.x.ai/v1/chat/completions", protocol: "chat" }
} as const;

export type ProviderName = keyof typeof PROVIDERS;
export type AiProviderRecord = {
  id: string;
  provider: string;
  label: string;
  model: string;
  secretCiphertext: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};
export function isProviderName(value: unknown): value is ProviderName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PROVIDERS, value);
}
export function publicProvider(row: AiProviderRecord) {
  return { id: row.id, provider: row.provider, label: row.label, model: row.model,
    enabled: row.enabled, isDefault: row.isDefault, hasKey: true,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function masterKey(): Buffer {
  const raw = process.env.AI_PROVIDER_ENCRYPTION_KEY || "";
  const decoded = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw new Error("AI_PROVIDER_ENCRYPTION_KEY_NOT_CONFIGURED");
  return decoded;
}
export function vaultConfigured() {
  try { masterKey(); return true; } catch { return false; }
}
export function encryptSecret(id: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptSecret(row: AiProviderRecord): string {
  const [version, iv, tag, content, extra] = row.secretCiphertext.split(".");
  if (version !== "v1" || !iv || !tag || !content || extra) throw new Error("INVALID_ENCRYPTED_SECRET");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(row.id));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(content, "base64url")), decipher.final()]).toString("utf8");
}
export async function preferredProvider(providerId?: string | null) {
  if (providerId) {
    return db.aiProviderCredential.findFirst({ where: { id: providerId, enabled: true } });
  }
  return db.aiProviderCredential.findFirst({
    where: { enabled: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
  });
}
type Message = { role: "system" | "user"; content: string };
export async function askProvider(
  row: AiProviderRecord,
  messages: Message[],
  opts: { maxTokens?: number; timeoutMs?: number } = {}
): Promise<string> {
  if (!isProviderName(row.provider)) throw new Error("INVALID_AI_PROVIDER");
  const preset = PROVIDERS[row.provider];
  const apiKey = decryptSecret(row);
  const maxTokens = Math.min(3000, Math.max(16, opts.maxTokens ?? 1800));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url: string = preset.endpoint;
  let body: unknown;
  if (preset.protocol === "gemini") {
    url = url.replace("{model}", encodeURIComponent(row.model));
    headers["x-goog-api-key"] = apiKey;
    body = {
      systemInstruction: { parts: [{ text: messages.filter(m => m.role === "system").map(m => m.content).join("\n") }] },
      contents: messages.filter(m => m.role !== "system").map(m => ({
        role: "user", parts: [{ text: m.content }]
      })),
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 }
    };
  } else if (preset.protocol === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2026-10-21";
    body = {
      model: row.model, max_tokens: maxTokens,
      system: messages.filter(m => m.role === "system").map(m => m.content).join("\n"),
      messages: messages.filter(m => m.role !== "system")
    };
  } else {
    headers.Authorization = "Bearer " + apiKey;
    body = { model: row.model, max_tokens: maxTokens, messages, temperature: 0.4 };
  }
  // Endpoint is a fixed allowlist. No administrator-controlled host/URL (SSRF protection).
  const response = await fetch(url, {
    method: "POST", headers, body: JSON.stringify(body), cache: "no-store",
    redirect: "error", signal: AbortSignal.timeout(Math.min(45000, opts.timeoutMs ?? 45000))
  });
  if (!response.ok) throw new Error("AI_PROVIDER_HTTP_" + response.status);
  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    content?: { type?: string; text?: string }[];
  };
  const text = preset.protocol === "gemini"
    ? data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("")
    : preset.protocol === "anthropic"
      ? data.content?.filter(p => p.type === "text").map(p => p.text || "").join("")
      : data.choices?.[0]?.message?.content;
  if (!text?.trim()) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  return text.trim();
}
