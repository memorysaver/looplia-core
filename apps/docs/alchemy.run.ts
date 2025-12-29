import alchemy from "alchemy";
import { Website } from "alchemy/cloudflare";

const app = await alchemy("looplia-docs");

export const site = await Website("looplia-docs", {
  name: "looplia-docs",
  build: "bun run build",
  assets: "./dist",
  domains: ["docs.looplia.run"],
});

console.log({ url: site.url });

await app.finalize();
