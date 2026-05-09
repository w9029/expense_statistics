export function normalizeSelectedIDsForQuery(
  selectedIDs: string[],
  availableIDs: string[],
) {
  const availableSet = new Set(availableIDs);
  const normalized = selectedIDs.filter(id => availableSet.has(id));
  return normalized.length ? normalized : undefined;
}
