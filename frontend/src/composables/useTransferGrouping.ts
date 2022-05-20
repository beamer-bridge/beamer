import type { Ref } from 'vue';
import { computed } from 'vue';

import type { Transfer } from '@/actions/transfers';

type TimeWindow = {
  label: string;
  priority: number;
  maxDaysAgo: number;
};

const OLDER_TIME_WINDOW: TimeWindow = {
  label: 'older',
  priority: -1,
  maxDaysAgo: Number.MAX_SAFE_INTEGER,
};

const ONE_DAY = 24 * 60 * 60 * 1000;

export function useTransferGrouping(
  transfers: Ref<Array<Transfer>>,
  timeWindows: Ref<Array<TimeWindow>>,
) {
  const now = Date.now();

  const allTimeWindowsSorted = computed(() =>
    [...timeWindows.value, OLDER_TIME_WINDOW].sort((a, b) => b.priority - a.priority),
  );

  const transfersToDaysAgo = computed(() =>
    transfers.value.map((transfer) => ({
      transfer,
      daysAgo: Math.floor((now - transfer.date.getTime()) / ONE_DAY),
    })),
  );

  const timeWindowLabelsToTransfers = computed(() => {
    const mapping: Record<string, Array<Transfer>> = {};

    transfersToDaysAgo.value.forEach(({ transfer, daysAgo }) => {
      const timeWindowLabel =
        allTimeWindowsSorted.value.find(({ maxDaysAgo }) => daysAgo < maxDaysAgo)?.label ??
        OLDER_TIME_WINDOW.label;

      if (mapping[timeWindowLabel]) {
        mapping[timeWindowLabel].push(transfer);
      } else {
        mapping[timeWindowLabel] = [transfer];
      }
    });

    return mapping;
  });

  const groupedAndSortedTransfers = computed(() => {
    const groups: Array<{ label: string; transfers: Array<Transfer> }> = [];

    allTimeWindowsSorted.value.forEach(({ label }) => {
      const transfers = timeWindowLabelsToTransfers.value[label] ?? [];
      transfers.sort((a, b) => b.date.getTime() - a.date.getTime());
      groups.push({ label, transfers });
    });

    return groups;
  });

  return { groupedAndSortedTransfers };
}
