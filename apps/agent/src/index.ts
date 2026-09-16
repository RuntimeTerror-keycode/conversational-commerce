const API_KEY_BY_PROVIDER: Record<string, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

const provider = process.env.MODEL_PROVIDER ?? "deepseek";
const apiKeyVar = API_KEY_BY_PROVIDER[provider];

if (!apiKeyVar) {
  throw new Error(
    `MODEL_PROVIDER "${provider}" is not supported — expected one of: ${Object.keys(API_KEY_BY_PROVIDER).join(", ")}`,
  );
}

if (!process.env[apiKeyVar]) {
  throw new Error(
    `${apiKeyVar} is not set, so every agent turn would fail at the model call. Copy .env.example to .env and fill it in.`,
  );
}

// Imported dynamically so the checks above run before models.ts resolves the
// model at module load — a static import would hoist above them.
const { createServer } = await import("./server.js");

const port = Number(process.env.PORT ?? 4111);
const app = createServer();

app.listen(port, () => {
  console.log(`agent listening on :${port} (provider=${provider}, model=${process.env.MODEL_MAIN ?? "deepseek-flash"})`);
});
