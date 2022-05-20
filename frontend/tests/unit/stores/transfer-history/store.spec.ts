import { createPinia, setActivePinia } from 'pinia';

import { useTransferHistory } from '@/stores/transfer-history/store';
import { generateTransfer } from '~/utils/data_generators';

describe('configuration store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('addTransfer()', () => {
    it('adds new transfer to the beginning of the list', () => {
      const history = useTransferHistory();
      const oldTransfer = generateTransfer();
      const newTransfer = generateTransfer();
      history.$state = { transfers: [oldTransfer] };

      history.addTransfer(newTransfer);

      expect(history.transfers).toHaveLength(2);
      expect(history.transfers[0]).toEqual(newTransfer);
    });
  });
});
