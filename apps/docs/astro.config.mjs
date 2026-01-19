// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://docs.looplia.run",
  integrations: [
    starlight({
      title: "Looplia",
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      description: "Skills-first agentic workflow CLI. Compose AI skills and workflows for any task.",
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://docs.looplia.run/og-image.png' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:width', content: '1200' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:height', content: '630' },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: 'https://docs.looplia.run/og-image.png' },
        },
      ],
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
            { label: "registry", slug: "cli/registry" },
            { label: "skill", slug: "cli/skill" },
          ],
        },
        {
          label: "Workflows",
          items: [
            { label: "Understanding Workflows", slug: "workflows/understanding-workflows" },
            { label: "Writing Kit", slug: "workflows/writing-kit" },
            { label: "Building Custom Workflows", slug: "workflows/custom-workflows" },
            {
              label: "Guides",
              items: [
                { label: "Overview", slug: "workflows/guides" },
                { label: "News Monitoring", slug: "workflows/guides/news-monitoring" },
              ],
            },
          ],
        },
        {
          label: "Agent Skill Registry",
          items: [
            { label: "Overview", slug: "registry/skill-registry" },
            { label: "Marketplace & Plugins", slug: "registry/marketplace-plugins" },
            { label: "Bootstrap Process", slug: "registry/bootstrap-process" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Sandbox Architecture", slug: "reference/sandbox" },
            { label: "Environment Variables", slug: "reference/environment-variables" },
            { label: "Troubleshooting", slug: "reference/troubleshooting" },
          ],
        },
      ],
    }),
  ],
});
