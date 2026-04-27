export function normalizeSelectedIDsForQuery(
  selectedIDs: string[],
  availableIDs: string[],
) {
  if (selectedIDs.length === 0) {
    return undefined;
  }

  const uniqueSelectedIDs = Array.from(new Set(selectedIDs));
  if (availableIDs.length === 0) {
    return uniqueSelectedIDs;
  }

  const availableIDSet = new Set(availableIDs);
  const validSelectedIDs = uniqueSelectedIDs.filter((id) => availableIDSet.has(id));
  if (validSelectedIDs.length === 0) {
    return undefined;
  }
  if (validSelectedIDs.length === availableIDs.length) {
    return undefined;
  }

  return validSelectedIDs;
}
