// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://looplia.dev",
  integrations: [
    starlight({
      title: "Looplia",
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      description: "Skills-first agentic workflow CLI. Compose AI skills and workflows for any task.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/memorysaver/looplia-core",
        },
      ],
      customCss: [
        './src/styles/custom.css',
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
            { label: "Core Concepts", slug: "getting-started/concepts" },
          ],
        },
        {
          label: "CLI Commands",
          items: [
            { label: "init", slug: "cli/init" },
            { label: "run", slug: "cli/run" },
            { label: "build", slug: "cli/build" },
            { label: "config", slug: "cli/config" },
          ],
        },
        {
          label: "Workflows",
          items: [
            { label: "Understanding Workflows", slug: "workflows/understanding-workflows" },
            { label: "Writing Kit", slug: "workflows/writing-kit" },
            { label: "Building Custom Workflows", slug: "workflows/custom-workflows" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Environment Variables", slug: "reference/environment-variables" },
            { label: "Troubleshooting", slug: "reference/troubleshooting" },
          ],
        },
      ],
    }),
  ],
});
