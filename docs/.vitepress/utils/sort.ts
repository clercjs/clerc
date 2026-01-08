export function comparePackages(aName: string, bName: string): number {
  const aScoped = aName.startsWith("@");
  const bScoped = bName.startsWith("@");
  if (aScoped && !bScoped) {
    return 1;
  }
  if (!aScoped && bScoped) {
    return -1;
  }

  return aName.localeCompare(bName);
}
