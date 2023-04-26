import type { SpyInstanceFn } from 'vitest';
import type { Ref } from 'vue';
import { ref } from 'vue';
import * as vueToastification from 'vue-toastification';

import type { Transfer } from '@/actions/transfers';
import { useTransferNotifications } from '@/composables/useTransferNotifications';
import { generateTransfer } from '~/utils/data_generators';

function getUseToastComposableMock(successFn?: SpyInstanceFn) {
  return {
    success: successFn ?? vi.fn(),
  };
}

vi.mock('vue-toastification', () => {
  return {
    useToast: vi.fn().mockReturnValue(getUseToastComposableMock()),
  };
});

function mockVueToastification() {
  Object.defineProperties(vueToastification, {
    useToast: {
      value: vi.fn().mockReturnValue(getUseToastComposableMock()),
    },
  });
}

describe('useTransferNotifications', () => {
  beforeEach(() => {
    mockVueToastification();
  });

  it('creates a toast notification to signal a sucessful transfer', async () => {
    const transfer = generateTransfer();
    const transfers = ref([transfer]);
    const successToast = vi.fn();

    Object.defineProperty(vueToastification, 'useToast', {
      value: vi.fn().mockReturnValue(getUseToastComposableMock(successToast)),
    });

    useTransferNotifications(transfers as Ref<Array<Transfer>>);

    transfer.emit('completed');

    expect(successToast).toHaveBeenCalled();
  });

  describe('when transfer completed', () => {
    it('removes all listeners on successful transfer completion', () => {
      const transfer = generateTransfer();
      const transfers = ref([transfer]);

      useTransferNotifications(transfers as Ref<Array<Transfer>>);

      transfer.emit('completed');

      expect(transfer.listenerCount('failed')).toBe(0);
      expect(transfer.listenerCount('completed')).toBe(0);
    });

    it('removes all listeners on transfer failure', () => {
      const transfer = generateTransfer();
      const transfers = ref([transfer]);

      useTransferNotifications(transfers as Ref<Array<Transfer>>);

      transfer.emit('failed');

      expect(transfer.listenerCount('failed')).toBe(0);
      expect(transfer.listenerCount('completed')).toBe(0);
    });
  });
});
