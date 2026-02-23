import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  copyPlugins,
  getLoopliaPluginPath,
  getPluginPaths,
  isDevMode,
  isLoopliaInitialized,
} from "../../src/bootstrap/index";
import { createTempWorkspace } from "../claude-agent-sdk/fixtures/test-data";

// Regex patterns for error matching (top-level for performance)
const NO_PLUGINS_ERROR = /No plugins found/;

/**
 * Create a mock plugin structure for testing
 */
async function createMockPluginSource(basePath: string): Promise<void> {
  // Create looplia-core plugin
  const coreDir = join(basePath, "looplia-core");
  await mkdir(join(coreDir, ".claude-plugin"), { recursive: true });
  await mkdir(join(coreDir, "skills", "test-skill"), { recursive: true });
  await mkdir(join(coreDir, "commands"), { recursive: true });

  await writeFile(
    join(coreDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "looplia", version: "0.6.5" })
  );
  await writeFile(
    join(coreDir, "skills", "test-skill", "skill.md"),
    "# Test Skill"
  );

  // Create looplia-writer plugin with workflows
  const writerDir = join(basePath, "looplia-writer");
  await mkdir(join(writerDir, ".claude-plugin"), { recursive: true });
  await mkdir(join(writerDir, "skills", "writer-skill"), { recursive: true });
  await mkdir(join(writerDir, "workflows"), { recursive: true });

  await writeFile(
    join(writerDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "looplia-writer", version: "0.6.5" })
  );
  await writeFile(
    join(writerDir, "workflows", "test-workflow.md"),
    "---\nname: test\n---\n# Test Workflow"
  );

  // Create marketplace.json in parent .claude-plugin folder
  await mkdir(join(basePath, "..", ".claude-plugin"), { recursive: true });
  await writeFile(
    join(basePath, "..", ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "looplia",
      plugins: [
        { name: "looplia-core", source: "./looplia-core" },
        { name: "looplia-writer", source: "./looplia-writer" },
      ],
    })
  );
}

describe("bootstrap", () => {
  let tempSource: { path: string; cleanup: () => Promise<void> };
  let tempTarget: { path: string; cleanup: () => Promise<void> };

  beforeEach(async () => {
    tempSource = await createTempWorkspace();
    tempTarget = await createTempWorkspace();
  });

  afterEach(async () => {
    await tempSource.cleanup();
    await tempTarget.cleanup();
  });

  describe("getLoopliaPluginPath", () => {
    it("should return path in home directory", () => {
      const path = getLoopliaPluginPath();
      expect(path).toBe(join(homedir(), ".looplia"));
    });
  });

  describe("copyPlugins", () => {
    it("should copy plugins from source to target plugins/ directory", async () => {
      const pluginsDir = join(tempSource.path, "plugins");
      await mkdir(pluginsDir, { recursive: true });
      await createMockPluginSource(pluginsDir);

      await copyPlugins(tempTarget.path, pluginsDir);

      // v0.8.0: Plugins are copied to plugins/ subdirectory
      const entries = await readdir(tempTarget.path);
      expect(entries).toContain("plugins");

      const pluginEntries = await readdir(join(tempTarget.path, "plugins"));
      expect(pluginEntries).toContain("looplia-core");
      expect(pluginEntries).toContain("looplia-writer");
    });

    it("should extract workflows to root workflows directory", async () => {
      const pluginsDir = join(tempSource.path, "plugins");
      await mkdir(pluginsDir, { recursive: true });
      await createMockPluginSource(pluginsDir);

      await copyPlugins(tempTarget.path, pluginsDir);

      // Check workflows were extracted
      const entries = await readdir(tempTarget.path);
      expect(entries).toContain("workflows");

      const workflows = await readdir(join(tempTarget.path, "workflows"));
      expect(workflows).toContain("test-workflow.md");
    });

    it("should remove workflows from plugin after extraction", async () => {
      const pluginsDir = join(tempSource.path, "plugins");
      await mkdir(pluginsDir, { recursive: true });
      await createMockPluginSource(pluginsDir);

      await copyPlugins(tempTarget.path, pluginsDir);

      // v0.8.0: Workflows directory should be removed from plugin in plugins/
      const writerEntries = await readdir(
        join(tempTarget.path, "plugins", "looplia-writer")
      );
      expect(writerEntries).not.toContain("workflows");
    });

    it("should create sandbox directory", async () => {
      const pluginsDir = join(tempSource.path, "plugins");
      await mkdir(pluginsDir, { recursive: true });
      await createMockPluginSource(pluginsDir);

      await copyPlugins(tempTarget.path, pluginsDir);

      const entries = await readdir(tempTarget.path);
      expect(entries).toContain("sandbox");
    });

    it("should create user-profile.json", async () => {
      const pluginsDir = join(tempSource.path, "plugins");
      await mkdir(pluginsDir, { recursive: true });
      await createMockPluginSource(pluginsDir);

      await copyPlugins(tempTarget.path, pluginsDir);

      const entries = await readdir(tempTarget.path);
      expect(entries).toContain("user-profile.json");

      const profile = JSON.parse(
        await readFile(join(tempTarget.path, "user-profile.json"), "utf-8")
      );
      expect(profile.userId).toBe("default");
      expect(profile.style).toBeDefined();
    });

    it("should throw when no plugins found", async () => {
      const emptyDir = join(tempSource.path, "empty");
      await mkdir(emptyDir, { recursive: true });

      await expect(copyPlugins(tempTarget.path, emptyDir)).rejects.toThrow(
        NO_PLUGINS_ERROR
      );
    });
  });

  describe("isLoopliaInitialized", () => {
    // Note: isLoopliaInitialized() uses homedir() which can't be easily mocked.
    // These tests verify behavior against actual ~/.looplia state.

    it("should return boolean indicating initialization state", async () => {
      const result = await isLoopliaInitialized();
      expect(typeof result).toBe("boolean");
    });

    it("should use getLoopliaPluginPath for path resolution", () => {
      // Verify the path used is ~/.looplia
      const path = getLoopliaPluginPath();
      expect(path).toBe(join(homedir(), ".looplia"));
    });
  });

  describe("getPluginPaths", () => {
    it("should return dev paths when LOOPLIA_DEV=true", async () => {
      const originalDev = process.env.LOOPLIA_DEV;
      const originalRoot = process.env.LOOPLIA_DEV_ROOT;

      process.env.LOOPLIA_DEV = "true";
      process.env.LOOPLIA_DEV_ROOT = tempSource.path;

      const paths = await getPluginPaths();

      process.env.LOOPLIA_DEV = originalDev;
      process.env.LOOPLIA_DEV_ROOT = originalRoot;

      expect(paths.length).toBe(2);
      expect(paths[0].type).toBe("local");
      expect(paths[0].path).toContain("looplia-core");
    });

    it("should expand tilde in LOOPLIA_DEV_ROOT", async () => {
      const originalDev = process.env.LOOPLIA_DEV;
      const originalRoot = process.env.LOOPLIA_DEV_ROOT;

      try {
        process.env.LOOPLIA_DEV = "true";
        process.env.LOOPLIA_DEV_ROOT = "~/test/workspace";

        const paths = await getPluginPaths();

        // Should expand tilde to the OS home directory
        expect(paths.length).toBe(2);
        expect(paths[0].path).toContain(`${homedir()}/test/workspace`);
        expect(paths[0].path).not.toContain("~");
      } finally {
        if (originalDev === undefined) {
          delete process.env.LOOPLIA_DEV;
        } else {
          process.env.LOOPLIA_DEV = originalDev;
        }
        if (originalRoot === undefined) {
          delete process.env.LOOPLIA_DEV_ROOT;
        } else {
          process.env.LOOPLIA_DEV_ROOT = originalRoot;
        }
      }
    });

    it("should return prod paths when LOOPLIA_DEV is not set", async () => {
      const originalDev = process.env.LOOPLIA_DEV;

      process.env.LOOPLIA_DEV = undefined;

      const paths = await getPluginPaths();

      process.env.LOOPLIA_DEV = originalDev;

      // In prod mode, returns array (may be empty if ~/.looplia doesn't exist)
      expect(Array.isArray(paths)).toBe(true);
      // If any paths exist, they should have the correct format
      if (paths.length > 0) {
        expect(paths[0].type).toBe("local");
      }
    });
  });

  describe("isDevMode", () => {
    it("should return true when LOOPLIA_DEV=true", () => {
      const original = process.env.LOOPLIA_DEV;
      process.env.LOOPLIA_DEV = "true";

      const result = isDevMode();

      process.env.LOOPLIA_DEV = original;
      expect(result).toBe(true);
    });

    it("should return false when LOOPLIA_DEV is not set", () => {
      const original = process.env.LOOPLIA_DEV;
      process.env.LOOPLIA_DEV = undefined;

      const result = isDevMode();

      process.env.LOOPLIA_DEV = original;
      expect(result).toBe(false);
    });

    it("should return false when LOOPLIA_DEV is not 'true'", () => {
      const original = process.env.LOOPLIA_DEV;
      process.env.LOOPLIA_DEV = "false";

      const result = isDevMode();

      process.env.LOOPLIA_DEV = original;
      expect(result).toBe(false);
    });
  });
});
