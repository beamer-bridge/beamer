import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';

import { Transfer } from '@/actions/transfers';
import { SubsidizedTransfer } from '@/actions/transfers/subsidized-transfer';
import { useTransferRequest } from '@/composables/useTransferRequest';
import * as feeSubService from '@/services/transactions/fee-sub';
import * as requestManagerService from '@/services/transactions/request-manager';
import type { Chain, EthereumAddress, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';
import {
  generateChain,
  generateToken,
  generateTransfer,
  generateUInt256Data,
  getRandomEthereumAddress,
} from '~/utils/data_generators';
import { MockedEthereumProvider } from '~/utils/mocks/ethereum-provider';

vi.mock('@ethersproject/providers');
vi.mock('@/services/transactions/request-manager');
vi.mock('@/service/transactions/fee-sub');

const SIGNER = new JsonRpcSigner(undefined, new JsonRpcProvider());
const SIGNER_ADDRESS = '0xSigner';
const PROVIDER = new MockedEthereumProvider({ signer: SIGNER, signerAddress: SIGNER_ADDRESS });

function createConfig(options?: {
  sourceChain?: Chain;
  targetChain?: Chain;
  sourceAmount?: string;
  targetAmount?: string;
  toAddress?: EthereumAddress;
  sourceToken?: Token;
  targetToken?: Token;
  approveInfiniteAmount?: boolean;
  requestCreatorAddress?: EthereumAddress;
}) {
  const sourceToken = options?.sourceToken ?? generateToken();
  const targetToken = options?.targetToken ?? generateToken();
  const sourceAmount = options?.sourceAmount ?? '123';
  const targetAmount = options?.targetAmount ?? '123';
  const sourceTokenAmount = TokenAmount.parse(sourceAmount, sourceToken);
  const targetTokenAmount = TokenAmount.parse(targetAmount, targetToken);

  return {
    sourceToken,
    targetToken,
    sourceAmount,
    targetAmount,
    sourceTokenAmount,
    targetTokenAmount,
    sourceChain: options?.sourceChain ?? generateChain(),
    targetChain: options?.targetChain ?? generateChain(),
    toAddress: options?.toAddress ?? getRandomEthereumAddress(),
    approveInfiniteAmount: options?.approveInfiniteAmount ?? false,
    requestCreatorAddress: options?.requestCreatorAddress ?? getRandomEthereumAddress(),
  };
}

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
      const {
        sourceChain,
        targetChain,
        sourceAmount,
        sourceTokenAmount,
        targetTokenAmount,
        toAddress,
        sourceToken,
        targetToken,
        requestCreatorAddress,
      } = createConfig();

      const { create } = useTransferRequest();
      const transfer: Transfer = await create({
        sourceChain,
        sourceAmount,
        targetChain,
        toAddress,
        sourceToken,
        targetToken,
        approveInfiniteAmount: true,
        requestCreatorAddress,
      });

      const feeAmount = TokenAmount.new(generatedFee, sourceToken);
      expect(requestManagerService.getRequestFee).toHaveBeenCalledOnce();
      expect(requestManagerService.getRequestFee).toHaveBeenCalledWith(
        sourceChain.rpcUrl,
        sourceChain.requestManagerAddress,
        sourceTokenAmount,
        targetChain.identifier,
      );
      expect(transfer).toBeDefined();
      expect(transfer).toBeInstanceOf(Transfer);
      expect(transfer.sourceChain).toEqual(sourceChain);
      expect(transfer.sourceAmount).toEqual(sourceTokenAmount);
      expect(transfer.targetChain).toEqual(targetChain);
      expect(transfer.targetAmount).toEqual(targetTokenAmount);
      expect(transfer.targetAccount).toEqual(toAddress);
      expect(transfer.fees).toEqual(feeAmount);
      expect(transfer.approveInfiniteAmount).toBe(true);
      expect(transfer.requestInformation?.requestAccount).toBe(requestCreatorAddress);
    });

    describe('if transfer can be subsidized', () => {
      it('creates and returns an instance of a SubsidizedTransfer class', async () => {
        const sourceChain = generateChain({ feeSubAddress: '0x123' });

        const {
          targetChain,
          sourceAmount,
          toAddress,
          sourceToken,
          targetToken,
          requestCreatorAddress,
        } = createConfig({ sourceChain });

        Object.defineProperty(feeSubService, 'amountCanBeSubsidized', {
          value: vi.fn().mockResolvedValue(true),
        });

        const { create } = useTransferRequest();
        const subsidizedTransfer = await create({
          sourceChain,
          sourceAmount,
          targetChain,
          toAddress,
          sourceToken,
          targetToken,
          approveInfiniteAmount: true,
          requestCreatorAddress,
        });

        expect(subsidizedTransfer).toBeInstanceOf(SubsidizedTransfer);
      });
    });
    describe('if transfer cannot be subsidized', () => {
      it('creates and returns an instance of a Transfer class', async () => {
        const {
          sourceChain,
          targetChain,
          sourceAmount,
          toAddress,
          sourceToken,
          targetToken,
          requestCreatorAddress,
        } = createConfig();

        Object.defineProperty(feeSubService, 'amountCanBeSubsidized', {
          value: vi.fn().mockResolvedValue(false),
        });

        const { create } = useTransferRequest();
        const subsidizedTransfer = await create({
          sourceChain,
          sourceAmount,
          targetChain,
          toAddress,
          sourceToken,
          targetToken,
          approveInfiniteAmount: true,
          requestCreatorAddress,
        });

        expect(subsidizedTransfer).toBeInstanceOf(Transfer);
      });
    });
  });

  describe('execute()', () => {
    it('executes the provided transfer object', () => {
      const { execute } = useTransferRequest();
      const transfer = generateTransfer();
      transfer.execute = vi.fn();
      execute(PROVIDER, transfer);
      expect(transfer.execute).toHaveBeenCalledWith(PROVIDER);
    });

    it('throws an error when provided signer is undefined', async () => {
      const { execute, executeError } = useTransferRequest();
      const transfer = generateTransfer();
      await execute(undefined, transfer);
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
