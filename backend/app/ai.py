"""Gerbang AI server-side dengan DeepSeek sebagai penyedia utama."""
import os
import asyncio
import httpx

PROVIDERS = {
    "deepseek": ("https://api.deepseek.com/chat/completions", "DEEPSEEK_API_KEY", "deepseek-chat"),
    "qwen": ("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", "QWEN_API_KEY", "qwen-plus"),
    "openai": ("https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY", "gpt-4.1-mini"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "GEMINI_API_KEY", "gemini-2.5-flash"),
}

class AIProviderError(RuntimeError):
    pass

async def complete(system: str, prompt: str, provider: str | None = None, max_tokens: int = 1500) -> dict:
    # Centralized default; only configured providers can be selected.
    provider = provider or os.getenv("AI_DEFAULT_PROVIDER", "deepseek")
    if provider not in PROVIDERS:
        raise AIProviderError("Penyedia AI tidak dikenal")
    endpoint, key_name, default_model = PROVIDERS[provider]
    key = os.getenv(key_name)
    if not key:
        raise AIProviderError("Penyedia AI belum dikonfigurasi")
    model = os.getenv(f"{provider.upper()}_MODEL", default_model)
    limit = min(max(max_tokens, 100), 2500)
    payload = {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}], "max_tokens": limit}
    async with httpx.AsyncClient(timeout=httpx.Timeout(45.0)) as client:
        for attempt in range(3):
            try:
                response = await client.post(endpoint, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=payload)
                if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                if not isinstance(content, str) or not content.strip():
                    raise AIProviderError("Respons AI kosong")
                return {"content": content, "provider": provider, "model": model, "usage": usage}
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt == 2:
                    raise AIProviderError("Layanan AI tidak dapat dihubungi") from exc
                await asyncio.sleep(2 ** attempt)
            except (httpx.HTTPStatusError, KeyError, IndexError, TypeError, ValueError) as exc:
                raise AIProviderError("Respons penyedia AI tidak valid atau ditolak") from exc
    raise AIProviderError("Permintaan AI gagal")
