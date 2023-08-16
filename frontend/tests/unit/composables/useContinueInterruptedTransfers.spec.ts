import type { Ref } from 'vue';
import { nextTick, ref, shallowRef } from 'vue';

import type { Transfer } from '@/actions/transfers';
import {
  continueInterruptedTransfers,
  useContinueInterruptedTransfers,
} from '@/composables/useContinueInterruptedTransfers';
import type { IEthereumWallet } from '@/services/web3-provider';
import { generateTransfer } from '~/utils/data_generators';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';

function generateSpyTransfer(options?: { completed?: boolean; failed?: boolean }): Transfer {
  const transfer = generateTransfer(options);

  Object.defineProperty(transfer, 'execute', {
    value: vi.fn().mockResolvedValue(undefined),
  });

  return transfer;
}

const PROVIDER = new MockedEthereumWallet();

describe('useContinueInterruptedTransfers', () => {
  describe('continueInterruptedTransfer()', () => {
    beforeEach(() => {
      global.console.error = vi.fn();
    });

    it('does nothing if all transfers are completed or failed', () => {
      const transfers = [
        generateSpyTransfer({ completed: true }),
        generateSpyTransfer({ failed: true }),
      ];

      continueInterruptedTransfers(transfers, PROVIDER);

      expect(transfers[0].execute).not.toHaveBeenCalled();
      expect(transfers[1].execute).not.toHaveBeenCalled();
    });

    it('executes the transfer if it has not failed nor been completed', () => {
      const transfers = [
        generateSpyTransfer({ completed: false, failed: false }),
        generateSpyTransfer({ completed: false, failed: false }),
      ];

      continueInterruptedTransfers(transfers, PROVIDER);

      expect(transfers[0].execute).toHaveBeenCalledOnce();
      expect(transfers[0].execute).toHaveBeenLastCalledWith(PROVIDER);
      expect(transfers[1].execute).toHaveBeenCalledOnce();
      expect(transfers[1].execute).toHaveBeenLastCalledWith(PROVIDER);
    });

    it('fiters list by interrupted transfers and executes them', () => {
      const transfers = [
        generateSpyTransfer({ completed: true }),
        generateSpyTransfer({ completed: false, failed: false }),
        generateSpyTransfer({ failed: true }),
        generateSpyTransfer({ completed: false, failed: false }),
      ];

      continueInterruptedTransfers(transfers, PROVIDER);

      expect(transfers[0].execute).not.toHaveBeenCalled();
      expect(transfers[1].execute).toHaveBeenCalled();
      expect(transfers[2].execute).not.toHaveBeenCalled();
      expect(transfers[3].execute).toHaveBeenCalled();
    });

    it('continues without errors any transfer execution throws', () => {
      const throwingTransfer = generateTransfer({ completed: false, failed: false });
      throwingTransfer.execute = vi.fn().mockRejectedValue(new Error());
      const normalTransfer = generateSpyTransfer({ completed: false, failed: false });
      const transfers = [throwingTransfer, normalTransfer];

      expect(() => continueInterruptedTransfers(transfers, PROVIDER)).not.toThrow();

      expect(transfers[0].execute).toHaveBeenCalledOnce();
      expect(transfers[1].execute).toHaveBeenCalledOnce();
    });
  });

  describe('useContinueInterruptedTransfers', () => {
    /*
     * Unfortunately it is not easy to mock/spy
     * `useContinueInterruptedTransfers` here as
     * `useContinueInterruptedTransfers` has a direct dependency on it within
     * the same module. Therefore we must take this workaround.
     */

    it('immediately continues interrupted transfers when transfers and provider are already loaded', () => {
      const transfer = generateSpyTransfer({ completed: false, failed: false });
      const transfers = ref([transfer]) as Ref<Array<Transfer>>;

      useContinueInterruptedTransfers(transfers, ref(true), shallowRef(PROVIDER));

      expect(transfer.execute).toHaveBeenCalledOnce();
    });

    it('waits until transfers are loaded until continues interrupted transfers', async () => {
      const transfer = generateSpyTransfer({ completed: false, failed: false });
      const transfers = ref([transfer]) as Ref<Array<Transfer>>;
      const transfersAreLoaded = ref(false);

      useContinueInterruptedTransfers(transfers, transfersAreLoaded, shallowRef(PROVIDER));

      expect(transfer.execute).not.toHaveBeenCalledOnce();

      transfersAreLoaded.value = true;
      await nextTick();

      expect(transfer.execute).toHaveBeenCalledOnce();
    });

    it('waits until provider is available until continues interrupted transfers', async () => {
      const transfer = generateSpyTransfer({ completed: false, failed: false });
      const transfers = ref([transfer]) as Ref<Array<Transfer>>;
      const provider = shallowRef(undefined) as Ref<IEthereumWallet | undefined>;

      useContinueInterruptedTransfers(transfers, ref(true), provider);

      expect(transfer.execute).not.toHaveBeenCalledOnce();

      provider.value = PROVIDER;
      await nextTick();

      expect(transfer.execute).toHaveBeenCalledOnce();
    });

    it('does not repeat execution of transfers after the first time loaded', async () => {
      const transfer = generateSpyTransfer({ completed: false, failed: false });
      const transfers = ref([transfer]) as Ref<Array<Transfer>>;
      const transfersAreLoaded = ref(false);

      useContinueInterruptedTransfers(transfers, transfersAreLoaded, shallowRef(PROVIDER));

      expect(transfer.execute).not.toHaveBeenCalledOnce();

      transfersAreLoaded.value = true;
      await nextTick();

      expect(transfer.execute).toHaveBeenCalledOnce();

      transfersAreLoaded.value = false;
      await nextTick();
      transfersAreLoaded.value = true;
      await nextTick();

      expect(transfer.execute).toHaveBeenCalledOnce();
    });
  });
});
