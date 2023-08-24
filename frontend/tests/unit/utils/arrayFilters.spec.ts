import { findMatchesByProperty, removeMatchesByProperty } from '@/utils/arrayFilters';

describe('filters', () => {
  describe('removeMatchesByProperty()', () => {
    it('filters out the objects from an array that are found in another array using property comparison', () => {
      const arrayRemoveFrom = [{ id: 1 }, { id: 4 }];
      const arrayCompareWith = [{ id: 4 }];
      const comparisonProperty = 'id';

      const result = removeMatchesByProperty(
        arrayRemoveFrom,
        arrayCompareWith,
        comparisonProperty,
      );

      expect(result).toEqual([{ id: 1 }]);
    });

    it('objects that are not common in both arrays are left intact', () => {
      const arrayRemoveFrom = [{ id: 1 }, { id: 4 }];
      const arrayCompareWith = [{ id: 3 }];
      const comparisonProperty = 'id';

      const result = removeMatchesByProperty(
        arrayRemoveFrom,
        arrayCompareWith,
        comparisonProperty,
      );

      expect(result).toEqual(arrayRemoveFrom);
    });
  });

  describe('findMatchesByProperty()', () => {
    it('only includes the objects from an array that are found in another array using property comparison', () => {
      const arrayFindFrom = [{ id: 1 }, { id: 4 }];
      const arrayCompareWith = [{ id: 4 }];
      const comparisonProperty = 'id';

      const result = findMatchesByProperty(arrayFindFrom, arrayCompareWith, comparisonProperty);

      expect(result).toEqual([{ id: 4 }]);
    });
  });
});
