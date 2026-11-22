export const platformArgv: string[] = process.argv.slice(
  "electron" in process.versions ? 1 : 2,
);
