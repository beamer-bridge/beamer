import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { ref } from 'vue';

import { Transfer } from '@/actions/transfers';
import { useTransferRequest } from '@/composables/useTransferRequest';
import * as requestManagerService from '@/services/transactions/request-manager';
import { TokenAmount } from '@/types/token-amount';
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
  let generatedFee: UInt256;

  beforeEach(() => {
    generatedFee = new UInt256(generateUInt256Data());
    Object.defineProperty(requestManagerService, 'getRequestFee', {
      value: vi.fn().mockResolvedValue(generatedFee),
    });
  });

  describe('create()', () => {
    it('creates and returns a new transfer object', async () => {
      const sourceChain = generateChain();
      const sourceAmount = '123';
      const targetAmount = '123';
      const targetChain = generateChain();
      const toAddress = getRandomEthereumAddress();
      const sourceToken = generateToken();
      const targetToken = generateToken();

      const { create } = useTransferRequest();
      const transfer: Transfer = await create({
        sourceChain,
        sourceAmount,
        targetChain,
        toAddress,
        sourceToken,
        targetToken,
      });

      const sourceTokenAmount = TokenAmount.parse(sourceAmount, sourceToken);
      const targetTokenAmount = TokenAmount.parse(targetAmount, targetToken);
      const feeAmount = TokenAmount.new(generatedFee, sourceToken);
      expect(requestManagerService.getRequestFee).toHaveBeenCalledOnce();
      expect(requestManagerService.getRequestFee).toHaveBeenCalledWith(
        sourceChain.rpcUrl,
        sourceChain.requestManagerAddress,
        sourceTokenAmount,
      );
      expect(transfer).toBeDefined();
      expect(transfer).toBeInstanceOf(Transfer);
      expect(transfer.sourceChain).toEqual(sourceChain);
      expect(transfer.sourceAmount).toEqual(sourceTokenAmount);
      expect(transfer.targetChain).toEqual(targetChain);
      expect(transfer.targetAmount).toEqual(targetTokenAmount);
      expect(transfer.targetAccount).toEqual(toAddress);
      expect(transfer.fees).toEqual(feeAmount);
    });
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
