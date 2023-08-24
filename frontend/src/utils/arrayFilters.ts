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

export function findMatchesByProperty<T extends Record<string, unknown>>(
  arrayFindFrom: T[],
  arrayCompareWith: T[],
  compareProperty: keyof T,
): T[] {
  return arrayFindFrom.filter((itemA) =>
    arrayCompareWith.find((itemB) => itemA[compareProperty] === itemB[compareProperty]),
  );
}
