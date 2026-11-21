// Minimal OpenAI-compatible chat client (Gemini, OpenRouter, Groq, OpenAI...).
// Plain fetch, no SDK: the request is one JSON POST.

export async function chat(messages, { json = false } = {}) {
  const { LLM_BASE_URL: base, LLM_API_KEY: key = '', LLM_MODEL: model } = process.env
  if (!base || !model) throw new Error('Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL in .env (see .env.example)')

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.2,
    ...(json && { response_format: { type: 'json_object' } }),
  })

  // Free tiers throttle bursts (429) or are briefly overloaded (503): retry a
  // couple of times, honouring the provider's Retry-After when it sends one.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body,
    })
    if (res.ok) {
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (!text) throw new Error(`LLM returned no content: ${JSON.stringify(data).slice(0, 300)}`)
      return text
    }
    const detail = (await res.text()).slice(0, 500)
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      const wait = Number(res.headers.get('retry-after')) || 5 * attempt
      await new Promise(r => setTimeout(r, Math.min(wait, 30) * 1000))
      continue
    }
    throw new Error(`LLM error ${res.status}: ${detail}`)
  }
}
