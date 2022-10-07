export function removeMatchesByProperty<T extends Record<string, unknown>>(
  arrayRemoveFrom: T[],
  arrayCompareWith: T[],
  compareProperty: keyof T,
): T[] {
  return arrayRemoveFrom.filter(
    (itemA) =>
      !arrayCompareWith.find((itemB) => itemA[compareProperty] === itemB[compareProperty]),
  );
}
