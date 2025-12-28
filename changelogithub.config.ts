import { defineConfig } from "changelogithub";

export default defineConfig({
  types: {
    ci: { title: "👷 CI" },
    chore: { title: "🧹 Chore" },
    test: { title: "🧪 Test" },
    refactor: { title: "🔨 Refactor" },
  },
});
