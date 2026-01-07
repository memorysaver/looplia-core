import alchemy from "alchemy";
import { CloudflareStateStore } from "alchemy/state";
import { Website } from "alchemy/cloudflare";

const app = await alchemy("looplia-docs", {
  stateStore: process.env.CI
    ? (scope) => new CloudflareStateStore(scope)
    : undefined, // Use default FileSystemStateStore locally
});

export const site = await Website("looplia-docs", {
  name: "looplia-docs",
  build: "bun run build",
  assets: "./dist",
  domains: ["docs.looplia.run"],
});

console.log({ url: site.url });

await app.finalize();
