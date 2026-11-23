// Edit models here. Nothing else needs to change when a model is retired.
export const CONFIG = {
  GEMINI_MODEL: "gemini-3.8-flash",
  OPENROUTER_MODEL: "openrouter/free",   // OpenRouter's free-models router; can be any OpenRouter model id
  temperature: 0.9,
  historyLimit: 14,
  maxMemoriesInPrompt: 80,
  retries: 2,          // extra tries per provider on 429/5xx/network errors
  retryBaseMs: 1000    // waits 1s, then 2s (exponential)
};
