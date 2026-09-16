import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 4111);
const app = createServer();

app.listen(port, () => {
  console.log(`api listening on :${port}`);
});
