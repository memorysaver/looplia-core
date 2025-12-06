/**
 * Copy markdown assets (agents, skills) to dist folder
 */
import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "../src/claude-agent-sdk");
const distDir = join(__dirname, "../dist/claude-agent-sdk");

async function copyAssets() {
  const assetDirs = ["agents", "skills"];

  for (const dir of assetDirs) {
    const src = join(srcDir, dir);
    const dest = join(distDir, dir);

    try {
      await mkdir(dirname(dest), { recursive: true });
      await cp(src, dest, { recursive: true });
      console.log(`Copied ${dir} to dist`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

copyAssets().catch(console.error);
