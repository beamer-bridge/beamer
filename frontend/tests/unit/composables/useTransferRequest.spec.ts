import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { ref } from 'vue';

import { Transfer } from '@/actions/transfers';
import { useTransferRequest } from '@/composables/useTransferRequest';
import * as requestManagerService from '@/services/transactions/request-manager';
import { UInt256 } from '@/types/uint-256';
import {
  generateChain,
  generateToken,
  generateTransfer,
  generateUInt256Data,
  getRandomEthereumAddress,
} from '~/utils/data_generators';

vi.mock('@ethersproject/providers');
vi.mock('@/services/transactions/request-manager');

const SIGNER = new JsonRpcSigner(undefined, new JsonRpcProvider());
const SIGNER_ADDRESS = '0xSigner';

describe('useTransferRequest', () => {
  beforeEach(() => {
    Object.defineProperty(requestManagerService, 'getRequestFee', {
      value: vi.fn().mockResolvedValue(new UInt256(generateUInt256Data())),
    });
  });

  describe('create()', () => {
    it('creates and returns a new transfer object', async () => {
      const { create } = useTransferRequest();

      const transfer = await create({
        sourceChain: generateChain(),
        sourceAmount: '123',
        targetChain: generateChain(),
        toAddress: getRandomEthereumAddress(),
        sourceToken: generateToken(),
        targetToken: generateToken(),
      });

      expect(transfer).toBeDefined();
      expect(transfer).toBeInstanceOf(Transfer);
    });
    // Todo: check if created instance holds correct values
  });

  describe('execute()', () => {
    it('executes the provided transfer object', () => {
      const { execute } = useTransferRequest();
      const transfer = generateTransfer();
      transfer.execute = vi.fn();
      const signerRef = ref(SIGNER);
      const signerAddressRef = ref(SIGNER_ADDRESS);
      execute(signerRef, signerAddressRef, transfer);
      expect(transfer.execute).toHaveBeenCalledWith(signerRef.value, signerAddressRef.value);
    });

    it('throws an error when provided signer is undefined', async () => {
      const { execute, executeError } = useTransferRequest();
      const transfer = generateTransfer();
      const signerRef = ref(undefined);
      const signerAddressRef = ref(undefined);
      await execute(signerRef, signerAddressRef, transfer);
      // Has to be tested this way since we are using useAsynchronousTask composable
      expect(executeError.value?.message).toEqual('No signer available!');
    });
  });

  describe('withdraw()', () => {
    it('triggers a fund withdrawal attempt for a specific transfer', async () => {
      const { withdraw } = useTransferRequest();
      const transferWithdrawFn = vi.fn();
      const transfer = { withdraw: transferWithdrawFn };
      const provider = 'fake-provider';

      await withdraw(transfer, provider);

      expect(transfer.withdraw).toHaveBeenCalledWith(provider);
    });
  });
});
