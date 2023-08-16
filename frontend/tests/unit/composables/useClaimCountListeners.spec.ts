import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { flushPromises } from '@vue/test-utils';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { Transfer } from '@/actions/transfers';
import { useClaimCountListeners } from '@/composables/useClaimCountListeners';
import * as requestManager from '@/services/transactions/request-manager';
import {
  generateRequestInformationData,
  generateTransferData,
  getRandomString,
} from '~/utils/data_generators';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';

vi.mock('@/services/transactions/request-manager');
vi.mock('@ethersproject/providers');

describe('useClaimCountListeners', () => {
  beforeEach(() => {
    Object.defineProperties(requestManager, {
      listenOnClaimCountChange: {
        value: vi.fn().mockReturnValue({ cancel: vi.fn() }),
      },
      getRequestData: {
        value: vi.fn().mockReturnValue({
          withdrawn: false,
          activeClaims: 0,
        }),
      },
    });
  });

  it('ignores transfer requests that are not expired', async () => {
    const data = generateTransferData({
      expired: false,
      requestInformation: generateRequestInformationData({ identifier: getRandomString() }),
    });
    const transfer = ref(new Transfer(data));

    transfer.value.startClaimEventListeners = vi.fn();
    transfer.value.checkAndUpdateState = vi.fn();

    const transfers = ref([transfer.value]) as Ref<Transfer[]>;

    useClaimCountListeners(transfers);

    await flushPromises();

    expect(transfer.value.startClaimEventListeners).not.toHaveBeenCalled();
  });

  it('syncs the state of the expired transfers before starting the listeners', async () => {
    const data = generateTransferData({
      expired: true,
      withdrawn: false,
      claimCount: 2,
      requestInformation: generateRequestInformationData({ identifier: getRandomString() }),
    });
    const transfer = ref(new Transfer(data));

    const transfers = ref([transfer.value, transfer.value]) as Ref<Transfer[]>;
    transfer.value.startClaimEventListeners = vi.fn();
    transfer.value.stopEventListeners = vi.fn();

    Object.defineProperties(requestManager, {
      getRequestData: {
        value: vi.fn().mockReturnValue({
          withdrawn: true,
          activeClaims: 0,
        }),
      },
    });

    useClaimCountListeners(transfers);

    await flushPromises();

    expect(transfer.value.startClaimEventListeners).not.toHaveBeenCalled();
    expect(transfer.value.stopEventListeners).not.toHaveBeenCalled();
  });

  it('starts the claim count listeners on transfer requests that were expired and not yet withdrawn', async () => {
    const data = generateTransferData({
      expired: true,
      withdrawn: false,
      requestInformation: generateRequestInformationData({ identifier: getRandomString() }),
    });
    const transfer = ref(new Transfer(data));

    transfer.value.startClaimEventListeners = vi.fn();
    transfer.value.checkAndUpdateState = vi.fn();
    const transfers = ref([transfer.value]) as Ref<Transfer[]>;

    useClaimCountListeners(transfers);

    await flushPromises();

    expect(transfer.value.startClaimEventListeners).toHaveBeenCalled();
  });

  it('stops all the claim count listeners on transfer requests once they are withdrawn', async () => {
    const data = generateTransferData({
      expired: true,
      withdrawn: false,
      requestInformation: generateRequestInformationData({ identifier: getRandomString() }),
    });
    const transfer = ref(new Transfer(data));

    transfer.value.stopEventListeners = vi.fn();
    const transfers = ref([transfer.value]) as Ref<Transfer[]>;

    useClaimCountListeners(transfers);

    await flushPromises();

    // Withdraw transfer
    Object.defineProperties(requestManager, {
      getRequestData: {
        value: vi.fn().mockReturnValue({
          withdrawn: false,
          activeClaims: 0,
        }),
      },
    });
    const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());
    const provider = new MockedEthereumWallet({
      chainId: transfer.value.sourceChain.identifier,
      signer,
    });
    await transfer.value.withdraw(provider);

    expect(transfer.value.stopEventListeners).toHaveBeenCalled();
  });
});
