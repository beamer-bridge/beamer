import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { flushPromises } from '@vue/test-utils';

import type { TransferData } from '@/actions/transfers/transfer';
import { Transfer } from '@/actions/transfers/transfer';
import * as fillManager from '@/services/transactions/fill-manager';
import { RequestExpiredError } from '@/services/transactions/request-manager';
import * as requestManager from '@/services/transactions/request-manager';
import * as tokenUtils from '@/services/transactions/token';
import * as transactionUtils from '@/services/transactions/utils';
import type { IEthereumProvider } from '@/services/web3-provider';
import type { Cancelable } from '@/types/async';
import { UInt256 } from '@/types/uint-256';
import {
  generateChain,
  generateRequestInformationData,
  generateStepData,
  generateToken,
  generateTokenAmountData,
  generateTransferData,
  generateUInt256Data,
  getRandomEthereumAddress,
  getRandomNumber,
  getRandomString,
} from '~/utils/data_generators';
import { MockedEthereumProvider } from '~/utils/mocks/ethereum-provider';

vi.mock('@ethersproject/providers');
vi.mock('@/services/transactions/token');
vi.mock('@/services/transactions/fill-manager');
vi.mock('@/services/transactions/request-manager');

class TestTransfer extends Transfer {
  public getStepMethods(provider: IEthereumProvider) {
    return super.getStepMethods(provider);
  }

  public ensureTokenAllowance(provider: IEthereumProvider) {
    return super.ensureTokenAllowance(provider);
  }

  public sendRequestTransaction(provider: IEthereumProvider) {
    return super.sendRequestTransaction(provider);
  }

  public waitForRequestEvent() {
    return super.waitForRequestEvent();
  }

  public waitForFulfillment() {
    return super.waitForFulfillment();
  }
}

const TRANSFER_DATA = generateTransferData();
const RPC_PROVIDER = new JsonRpcProvider();
const PROVIDER = new MockedEthereumProvider();
const SIGNER = new JsonRpcSigner(undefined, RPC_PROVIDER);
const SIGNER_ADDRESS = '0xSigner';
const PROVIDER_WITH_SIGNER = new MockedEthereumProvider({
  signer: SIGNER,
  signerAddress: SIGNER_ADDRESS,
});

function createTestCancelable<T>(options?: {
  result?: T;
  error?: unknown;
  cancel?: () => void;
}): () => Cancelable<T> {
  const { result, error, cancel = vi.fn() } = options || {};
  const promise = result
    ? Promise.resolve(result)
    : error
    ? Promise.reject(error)
    : new Promise<T>(() => undefined);
  return () => ({ promise, cancel });
}

// A shortcut to make some tests having less lines and better readable.
function define(object: unknown, property: string, value: unknown): void {
  Object.defineProperty(object, property, { value });
}

describe('transfer', () => {
  beforeEach(() => {
    Object.defineProperties(tokenUtils, {
      ensureTokenAllowance: { value: vi.fn().mockResolvedValue(undefined) },
    });

    Object.defineProperties(requestManager, {
      sendRequestTransaction: { value: vi.fn().mockResolvedValue('0xHash') },
      getRequestInformation: {
        value: vi.fn().mockResolvedValue({ requestId: '0x123', timestamp: 100 }),
      },
      getRequestData: {
        value: vi.fn().mockResolvedValue({
          withdrawn: false,
        }),
      },
      failWhenRequestExpires: {
        value: vi.fn().mockReturnValue({
          promise: new Promise(() => undefined),
          cancel: vi.fn(),
        }),
      },
      listenOnClaimCountChange: {
        value: vi.fn().mockReturnValue({
          cancel: vi.fn(),
        }),
      },
    });

    Object.defineProperties(transactionUtils, {
      getCurrentBlockNumber: { value: vi.fn().mockResolvedValue(0) },
    });

    Object.defineProperties(fillManager, {
      waitForFulfillment: {
        value: vi.fn().mockReturnValue({
          promise: new Promise<number>((resolve) => resolve(100)),
          cancel: vi.fn(),
        }),
      },
    });
  });

  afterEach(() => {
    flushPromises();
  });

  it('defines a method for every step', () => {
    const transfer = new TestTransfer(TRANSFER_DATA);

    const methods = transfer.getStepMethods(PROVIDER_WITH_SIGNER);

    for (const step of transfer.steps) {
      expect(methods[step.identifier]).toBeDefined();
    }
  });

  describe('execute()', () => {
    it('triggers all protocol relevant functions', async () => {
      const transfer = new TestTransfer(TRANSFER_DATA);

      await transfer.execute(PROVIDER_WITH_SIGNER);

      expect(tokenUtils.ensureTokenAllowance).toHaveBeenCalledTimes(1);
      expect(requestManager.sendRequestTransaction).toHaveBeenCalledTimes(1);
      expect(requestManager.getRequestInformation).toHaveBeenCalledTimes(1);
      expect(requestManager.failWhenRequestExpires).toHaveBeenCalledTimes(1);
      expect(fillManager.waitForFulfillment).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureTokenAllowance()', async () => {
    it('makes a call to set the allowance for the source token with minimum value of source amount plus fees ', async () => {
      const data = generateTransferData({
        fees: generateTokenAmountData({ amount: '2' }),
        sourceChain: generateChain({ requestManagerAddress: '0xRequestManager' }),
        sourceAmount: generateTokenAmountData({
          token: generateToken({ address: '0xSourceToken' }),
          amount: '1',
        }),
      });
      const transfer = new TestTransfer(data);
      const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());
      const provider = new MockedEthereumProvider({
        signer: signer,
        signerAddress: SIGNER_ADDRESS,
      });

      await transfer.ensureTokenAllowance(provider);

      expect(tokenUtils.ensureTokenAllowance).toHaveBeenCalledTimes(1);
      expect(tokenUtils.ensureTokenAllowance).toHaveBeenLastCalledWith(
        provider,
        '0xSourceToken',
        '0xRequestManager',
        new UInt256('3'),
      );
    });

    it('sets the allowance to the infinite amount if the approveInfiniteAmount flag is set', async () => {
      const data = generateTransferData({
        fees: generateTokenAmountData({ amount: '2' }),
        sourceChain: generateChain({ requestManagerAddress: '0xRequestManager' }),
        sourceAmount: generateTokenAmountData({
          token: generateToken({ address: '0xSourceToken' }),
          amount: '1',
        }),
        approveInfiniteAmount: true,
      });
      const transfer = new TestTransfer(data);
      const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());
      const provider = new MockedEthereumProvider({
        signer: signer,
        signerAddress: SIGNER_ADDRESS,
      });

      await transfer.ensureTokenAllowance(provider);

      expect(tokenUtils.ensureTokenAllowance).toHaveBeenCalledTimes(1);
      expect(tokenUtils.ensureTokenAllowance).toHaveBeenLastCalledWith(
        provider,
        '0xSourceToken',
        '0xRequestManager',
        UInt256.max(),
      );
    });
  });

  describe('sendRequestTransaction()', () => {
    it('fails if given signer address is undefined', async () => {
      const data = generateTransferData();
      const transfer = new TestTransfer(data);
      const provider = new MockedEthereumProvider({ signer: undefined, signerAddress: undefined });

      await expect(transfer.sendRequestTransaction(provider)).rejects.toThrow('Missing signer!');
    });

    it('calls the transfer function on the request manager contract', async () => {
      const data = generateTransferData({
        sourceChain: generateChain({ requestManagerAddress: '0xRequestManager' }),
        sourceAmount: generateTokenAmountData({
          token: generateToken({ address: '0xSourceToken' }),
          amount: '1',
        }),
        targetChain: generateChain({ identifier: 2 }),
        targetAmount: generateTokenAmountData({
          token: generateToken({ address: '0xTargetToken' }),
          amount: '1',
        }),
        targetAccount: '0xTargetAccount',
        validityPeriod: generateUInt256Data('3'),
        fees: generateTokenAmountData({ amount: '4' }),
      });
      const transfer = new TestTransfer(data);
      const signer = new JsonRpcSigner(undefined, RPC_PROVIDER);
      const provider = new MockedEthereumProvider({
        signer: signer,
        signerAddress: SIGNER_ADDRESS,
      });

      await transfer.sendRequestTransaction(provider);

      expect(requestManager.sendRequestTransaction).toHaveBeenCalledTimes(1);
      expect(requestManager.sendRequestTransaction).toHaveBeenLastCalledWith(
        provider,
        new UInt256('1'),
        2,
        '0xRequestManager',
        '0xSourceToken',
        '0xTargetToken',
        '0xTargetAccount',
        new UInt256('3'),
      );
    });

    it('sets the request account and transaction hash', async () => {
      define(requestManager, 'sendRequestTransaction', vi.fn().mockResolvedValue('0xHash'));
      define(transactionUtils, 'getCurrentBlockNumber', vi.fn().mockResolvedValue(2));
      const transfer = new TestTransfer(TRANSFER_DATA);

      expect(transfer.requestInformation?.requestAccount).toBeUndefined();
      expect(transfer.requestInformation?.transactionHash).toBeUndefined();
      const provider = new MockedEthereumProvider({ signer: SIGNER, signerAddress: '0xSigner' });

      await transfer.sendRequestTransaction(provider);

      expect(transfer.requestInformation?.requestAccount).toBe('0xSigner');
      expect(transfer.requestInformation?.transactionHash).toBe('0xHash');
      expect(transfer.requestInformation?.blockNumberOnTargetChain).toBe(2);
    });
  });

  describe('waitForRequestEvent()', () => {
    it('fails when transaction hash has not been set', async () => {
      const data = generateTransferData({
        requestInformation: generateRequestInformationData({ transactionHash: '' }),
      });
      const transfer = new TestTransfer(data);

      await expect(transfer.waitForRequestEvent()).rejects.toThrow(
        'Attempt to get request event before sending transaction!',
      );
    });

    it('uses the stored request transaction hash', async () => {
      const data = generateTransferData({
        sourceChain: generateChain({
          internalRpcUrl: 'https://source.rpc',
          requestManagerAddress: '0xRequestManager',
        }),
        requestInformation: generateRequestInformationData({
          transactionHash: '0xHash',
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForRequestEvent();

      expect(requestManager.getRequestInformation).toHaveBeenCalledTimes(1);
      expect(requestManager.getRequestInformation).toHaveBeenLastCalledWith(
        'https://source.rpc',
        '0xRequestManager',
        '0xHash',
      );
    });

    it('fetches & saves the identifier & timestamp of the transfer', async () => {
      const data = generateTransferData({
        requestInformation: generateRequestInformationData(),
      });
      const transfer = new TestTransfer(data);
      const identifier = '0x123';
      const timestamp = 100;

      define(
        requestManager,
        'getRequestInformation',
        vi.fn().mockResolvedValue({ requestId: identifier, timestamp }),
      );

      await transfer.waitForRequestEvent();

      expect(transfer.requestInformation?.identifier).toBe(identifier);
      expect(transfer.requestInformation?.timestamp).toBe(timestamp);
    });
  });

  describe('waitForFulfillment()', () => {
    const TRANSFER_DATA = generateTransferData({
      requestInformation: generateRequestInformationData({
        identifier: getRandomString(),
      }),
    });

    it('fails when request identifier has not been set', async () => {
      const transfer = new TestTransfer({
        ...TRANSFER_DATA,
        requestInformation: generateRequestInformationData({
          identifier: undefined,
        }),
      });

      await expect(transfer.waitForFulfillment()).rejects.toThrow(
        'Attempting to wait for fulfillment without request identifier!',
      );
    });

    it('uses the correct parameters to wait for the request fill', async () => {
      const identifier = getRandomString();
      const data = generateTransferData({
        targetChain: generateChain({
          internalRpcUrl: 'https://target.rpc',
          fillManagerAddress: '0xFillManager',
        }),
        requestInformation: generateRequestInformationData({
          identifier,
          blockNumberOnTargetChain: 2,
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForFulfillment();
      expect(fillManager.waitForFulfillment).toHaveBeenCalledTimes(1);
      expect(fillManager.waitForFulfillment).toHaveBeenLastCalledWith(
        'https://target.rpc',
        '0xFillManager',
        identifier,
        2,
      );
    });

    it('uses the correct parameters to wait for the request expiration', async () => {
      const identifier = getRandomString();
      const data = generateTransferData({
        sourceChain: generateChain({
          internalRpcUrl: 'https://source.rpc',
          requestManagerAddress: '0xRequestManager',
        }),
        requestInformation: generateRequestInformationData({
          identifier,
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForFulfillment();

      expect(requestManager.failWhenRequestExpires).toHaveBeenCalledTimes(1);
      expect(requestManager.failWhenRequestExpires).toHaveBeenLastCalledWith(
        'https://source.rpc',
        '0xRequestManager',
        identifier,
      );
    });

    it('cancels waiting for exception when request got fulfilled', async () => {
      const cancel = vi.fn();
      define(requestManager, 'failWhenRequestExpires', createTestCancelable({ cancel }));
      define(fillManager, 'waitForFulfillment', createTestCancelable({ result: true }));
      const transfer = new TestTransfer(TRANSFER_DATA);

      await transfer.waitForFulfillment();

      expect(cancel).toHaveBeenCalledOnce();
    });

    it('cancels waiting for fulfillment when request has expired', async () => {
      const cancel = vi.fn();
      define(requestManager, 'failWhenRequestExpires', createTestCancelable({ error: true }));
      define(fillManager, 'waitForFulfillment', createTestCancelable({ cancel }));
      const transfer = new TestTransfer(TRANSFER_DATA);

      try {
        await transfer.waitForFulfillment();
      } catch {
        // Ignore on purpose
      }

      expect(cancel).toHaveBeenCalledOnce();
    });

    it('sets transfer to be expired if expiration promise rejects with according error', async () => {
      const error = new RequestExpiredError();
      define(requestManager, 'failWhenRequestExpires', createTestCancelable({ error }));
      define(fillManager, 'waitForFulfillment', createTestCancelable());
      const transfer = new TestTransfer({ ...TRANSFER_DATA, expired: false });
      transfer.checkAndUpdateState = vi.fn();

      try {
        await transfer.waitForFulfillment();
      } catch {
        // Ignore on purpose
      }

      expect(transfer.expired).toBeTruthy();
      expect(transfer.checkAndUpdateState).toHaveBeenCalledOnce();
    });

    it('saves the fulfillment timestamp if transfer has been filled', async () => {
      const data = generateTransferData({
        requestInformation: generateRequestInformationData({
          identifier: '0x123',
        }),
      });
      const transfer = new TestTransfer(data);
      const fulfillmentTimestamp = 100;

      define(
        fillManager,
        'waitForFulfillment',
        createTestCancelable({ result: fulfillmentTimestamp }),
      );

      await transfer.waitForFulfillment();

      expect(transfer.requestFulfillment?.timestamp).toBe(fulfillmentTimestamp);
    });
  });

  describe('withdraw', () => {
    const TRANSFER_DATA = generateTransferData({
      expired: true,
      withdrawn: false,
      claimCount: 0,
      requestInformation: generateRequestInformationData({
        identifier: getRandomString(),
      }),
    });

    it('fails if the transfer is not expired', async () => {
      const transfer = new TestTransfer({ ...TRANSFER_DATA, expired: false });

      await expect(transfer.withdraw(PROVIDER)).rejects.toThrow(
        'Can only withdraw transfer funds after request expired!',
      );
    });

    it('fails when request identifier has not been set', async () => {
      const transfer = new TestTransfer({
        ...TRANSFER_DATA,
        requestInformation: generateRequestInformationData({ identifier: undefined }),
      });

      await expect(transfer.withdraw(PROVIDER)).rejects.toThrow(
        'Attempting to withdraw without request identifier!',
      );
    });

    it('checks withdraw state again if it is false', async () => {
      const transfer = new TestTransfer({ ...TRANSFER_DATA, withdrawn: false });
      transfer.checkAndUpdateState = vi.fn();

      try {
        await transfer.withdraw(PROVIDER);
      } catch {
        /* ignore */
      }

      expect(transfer.checkAndUpdateState).toHaveBeenCalledOnce();
    });

    it('fails when funds are already withdrawn', async () => {
      const transfer = new TestTransfer({ ...TRANSFER_DATA, withdrawn: true });

      await expect(transfer.withdraw(PROVIDER)).rejects.toThrow(
        'Funds have been already withdrawn!',
      );
    });

    it('fails when there are active claims', async () => {
      const transfer = new TestTransfer({ ...TRANSFER_DATA, claimCount: 2 });
      transfer.checkAndUpdateState = vi.fn().mockReturnValue({ claimCount: 2 });

      await expect(transfer.withdraw(PROVIDER)).rejects.toThrow(
        'Cannot withdraw when there are active claims!',
      );
    });

    it('fails when no signer is available', async () => {
      const transfer = new TestTransfer(TRANSFER_DATA);
      const provider = new MockedEthereumProvider({ signer: undefined });

      await expect(transfer.withdraw(provider)).rejects.toThrow(
        'Cannot withdraw without connected wallet!',
      );
    });

    it('triggers a chain switch if provider chain and source chain differ', async () => {
      const transfer = new TestTransfer({
        ...TRANSFER_DATA,
        sourceChain: generateChain({ identifier: 1 }),
      });
      const provider = new MockedEthereumProvider({ chainId: 2, signer: SIGNER });
      provider.switchChainSafely = vi.fn().mockResolvedValue(true);

      await transfer.withdraw(provider);

      expect(provider.switchChainSafely).toHaveBeenCalledOnce();
    });

    it('fails when the chain switch was not successful', async () => {
      const transfer = new TestTransfer({
        ...TRANSFER_DATA,
        sourceChain: generateChain({ identifier: 1 }),
      });
      const provider = new MockedEthereumProvider({ chainId: 2, signer: SIGNER });
      provider.switchChainSafely = vi.fn().mockResolvedValue(false);

      await expect(transfer.withdraw(provider)).rejects.toThrow(
        'Cannot withdraw without switching to the chain where the tokens are!',
      );
    });

    it('fails when a chain switch is necessary but switching chains is not implemented', async () => {
      const transfer = new TestTransfer({
        ...TRANSFER_DATA,
        sourceChain: generateChain({ identifier: 1 }),
      });
      const provider = new MockedEthereumProvider({ chainId: 2, signer: SIGNER });
      provider.switchChainSafely = undefined;

      await expect(transfer.withdraw(provider)).rejects.toThrow(
        'For a withdrawal, you need to connect to the chain where the tokens are through your wallet!',
      );
    });

    it('uses the correct parameters to make the withdraw', async () => {
      const identifier = getRandomString();
      const data = generateTransferData({
        expired: true,
        requestInformation: generateRequestInformationData({
          identifier,
        }),
        sourceChain: generateChain({
          identifier: 1,
          requestManagerAddress: '0xRequestManager',
        }),
      });
      const transfer = new TestTransfer(data);
      const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());
      const provider = new MockedEthereumProvider({ chainId: 1, signer });

      await transfer.withdraw(provider);

      expect(requestManager.withdrawRequest).toHaveBeenCalledOnce();
      expect(requestManager.withdrawRequest).toHaveBeenLastCalledWith(
        provider,
        '0xRequestManager',
        identifier,
      );
    });
  });

  describe('checkAndUpdateState()', () => {
    const TRANSFER_DATA = generateTransferData({
      requestInformation: generateRequestInformationData({
        identifier: getRandomString(),
      }),
    });

    it('fails if request identifier has not been set', async () => {
      const transfer = new TestTransfer({
        ...TRANSFER_DATA,
        requestInformation: generateRequestInformationData({
          identifier: undefined,
        }),
      });

      await expect(transfer.checkAndUpdateState()).rejects.toThrow(
        'Can not check state without request identfier!',
      );
    });

    it('uses the correct parameters to query the request data', async () => {
      const identifier = getRandomString();
      const data = generateTransferData({
        sourceChain: generateChain({
          internalRpcUrl: 'https://source.rpc',
          requestManagerAddress: '0xRequestManager',
        }),
        requestInformation: generateRequestInformationData({
          identifier,
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.checkAndUpdateState();

      expect(requestManager.getRequestData).toHaveBeenCalledOnce();
      expect(requestManager.getRequestData).toHaveBeenLastCalledWith(
        'https://source.rpc',
        '0xRequestManager',
        identifier,
      );
    });
    it('updates internal state based on contract state', async () => {
      define(
        requestManager,
        'getRequestData',
        vi.fn().mockResolvedValue({ withdrawn: true, activeClaims: 3 }),
      );
      const transfer = new TestTransfer({ ...TRANSFER_DATA, withdrawn: false, claimCount: 0 });

      expect(transfer.withdrawn).toBe(false);
      expect(transfer.hasActiveClaims).toBe(false);

      await transfer.checkAndUpdateState();

      expect(transfer.withdrawn).toBe(true);
      expect(transfer.hasActiveClaims).toBe(true);
    });
  });

  describe('encode()', () => {
    it('serializes all data to persist the whole transfer', () => {
      const sourceChain = generateChain();
      const sourceAmount = generateTokenAmountData();
      const targetChain = generateChain();
      const targetAmount = generateTokenAmountData();
      const targetAccount = getRandomEthereumAddress();
      const validityPeriod = generateUInt256Data();
      const fees = generateTokenAmountData();
      const date = 1652688517448;
      const requestInformation = generateRequestInformationData();
      const expired = true;
      const withdrawn = true;
      const claimCount = getRandomNumber();
      const steps = [generateStepData()];
      const data: TransferData = {
        sourceChain,
        sourceAmount,
        targetChain,
        targetAmount,
        targetAccount,
        validityPeriod,
        fees,
        date,
        requestInformation,
        expired,
        withdrawn,
        claimCount,
        steps,
      };
      const transfer = new TestTransfer(data);

      const encodedData = transfer.encode();

      expect(encodedData.sourceChain).toMatchObject(sourceChain);
      expect(encodedData.sourceAmount).toMatchObject(sourceAmount);
      expect(encodedData.targetChain).toMatchObject(targetChain);
      expect(encodedData.targetAmount).toMatchObject(targetAmount);
      expect(encodedData.targetAccount).toMatchObject(targetAccount);
      expect(encodedData.validityPeriod).toMatchObject(validityPeriod);
      expect(encodedData.fees).toMatchObject(fees);
      expect(encodedData.date).toMatchObject(date);
      expect(encodedData.requestInformation).toMatchObject(requestInformation);
      expect(encodedData.expired).toBe(true);
      expect(encodedData.withdrawn).toBe(true);
      expect(encodedData.steps).toMatchObject(steps);
      expect(encodedData.claimCount).toBe(claimCount);
    });

    it('can be used to re-instantiate transfer again', () => {
      const data = generateTransferData();
      const transfer = new TestTransfer(data);

      const encodedData = transfer.encode();
      const newTransfer = new TestTransfer(encodedData);
      const newEncodedData = newTransfer.encode();

      expect(encodedData).toMatchObject(newEncodedData);
    });
  });

  describe('startClaimEventListeners()', () => {
    it('starts listening on claim events in order to sync the claimCount state', () => {
      const data = generateTransferData({
        requestInformation: generateRequestInformationData({ identifier: '123' }),
      });
      const transfer = new TestTransfer(data);

      transfer.startClaimEventListeners();

      expect(requestManager.listenOnClaimCountChange).toHaveBeenCalledWith({
        rpcUrl: transfer.sourceChain.rpcUrl,
        requestManagerAddress: transfer.sourceChain.requestManagerAddress,
        requestIdentifier: transfer.requestInformation?.identifier,
        onReduce: expect.any(Function),
        onIncrease: expect.any(Function),
      });
    });
    it('cannot instantiate more then 1 active listener at a time', () => {
      const data = generateTransferData({
        requestInformation: generateRequestInformationData({ identifier: '123' }),
      });
      const transfer = new TestTransfer(data);

      transfer.startClaimEventListeners();

      expect(() => transfer.startClaimEventListeners()).toThrow(
        'There are already active listeners.',
      );
    });
  });

  describe('stopEventListeners()', () => {
    it('stops all listeners', () => {
      const data = generateTransferData({
        requestInformation: generateRequestInformationData({ identifier: '123' }),
      });
      const transfer = new TestTransfer(data);

      const cancelCallback = vi.fn();
      define(
        requestManager,
        'listenOnClaimCountChange',
        vi.fn().mockReturnValue({ cancel: cancelCallback }),
      );

      expect(transfer.hasActiveListeners).toBe(false);

      transfer.startClaimEventListeners();

      expect(transfer.hasActiveListeners).toBe(true);

      transfer.stopEventListeners();

      expect(transfer.hasActiveListeners).toBe(false);
      expect(cancelCallback).toHaveBeenCalled();
    });
  });
});
