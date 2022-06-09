import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { flushPromises } from '@vue/test-utils';

import type { TransferData } from '@/actions/transfers/transfer';
import { Transfer } from '@/actions/transfers/transfer';
import * as fillManager from '@/services/transactions/fill-manager';
import { RequestExpiredError } from '@/services/transactions/request-manager';
import * as requestManager from '@/services/transactions/request-manager';
import * as tokenUtils from '@/services/transactions/token';
import type { EthereumAddress } from '@/types/data';
import { UInt256 } from '@/types/uint-256';
import {
  generateChain,
  generateFulfillmentInformation,
  generateRequestInformationData,
  generateStepData,
  generateToken,
  generateTokenAmountData,
  generateTransferData,
  generateUInt256Data,
  getRandomEthereumAddress,
} from '~/utils/data_generators';
import { MockedEthereumProvider } from '~/utils/mocks/ethereum-provider';

vi.mock('@ethersproject/providers');
vi.mock('@/services/transactions/token');
vi.mock('@/services/transactions/fill-manager');
vi.mock('@/services/transactions/request-manager');

class TestTransfer extends Transfer {
  public getStepMethods(signer: JsonRpcSigner, signerAddress: EthereumAddress) {
    return super.getStepMethods(signer, signerAddress);
  }

  public ensureTokenAllowance(signer: JsonRpcSigner) {
    return super.ensureTokenAllowance(signer);
  }

  public sendRequestTransaction(signer: JsonRpcSigner, signerAddress: EthereumAddress) {
    return super.sendRequestTransaction(signer, signerAddress);
  }

  public waitForRequestEvent() {
    return super.waitForRequestEvent();
  }

  public waitForFulfillment() {
    return super.waitForFulfillment();
  }
}

const DATA = generateTransferData();
const PROVIDER = new JsonRpcProvider();
const SIGNER = new JsonRpcSigner(undefined, PROVIDER);
const SIGNER_ADDRESS = '0xSigner';

describe('transfer', () => {
  beforeEach(() => {
    Object.defineProperties(tokenUtils, {
      ensureTokenAllowance: { value: vi.fn().mockResolvedValue(undefined) },
    });

    Object.defineProperties(requestManager, {
      sendRequestTransaction: { value: vi.fn().mockResolvedValue('0xHash') },
      getRequestIdentifier: { value: vi.fn().mockResolvedValue(1) },
      waitUntilRequestExpiresAndFail: {
        value: vi.fn().mockReturnValue({
          promise: new Promise(() => undefined),
          cancel: vi.fn(),
        }),
      },
    });

    Object.defineProperties(fillManager, {
      waitForFulfillment: {
        value: vi.fn().mockReturnValue({
          promise: new Promise<void>((resolve) => resolve()),
          cancel: vi.fn(),
        }),
      },
    });
  });

  afterEach(() => {
    flushPromises();
  });

  it('defines a method for every step', () => {
    const transfer = new TestTransfer(DATA);

    const methods = transfer.getStepMethods(SIGNER, SIGNER_ADDRESS);

    for (const step of transfer.steps) {
      expect(methods[step.identifier]).toBeDefined();
    }
  });

  describe('execute()', () => {
    it('triggers all protocol relevant functions', async () => {
      const transfer = new TestTransfer(DATA);

      await transfer.execute(SIGNER, SIGNER_ADDRESS);

      expect(tokenUtils.ensureTokenAllowance).toHaveBeenCalledTimes(1);
      expect(requestManager.sendRequestTransaction).toHaveBeenCalledTimes(1);
      expect(requestManager.getRequestIdentifier).toHaveBeenCalledTimes(1);
      expect(requestManager.waitUntilRequestExpiresAndFail).toHaveBeenCalledTimes(1);
      expect(fillManager.waitForFulfillment).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureTokenAllowance()', () => {
    it('calls the token utility function for the source token', async () => {
      const data = generateTransferData({
        sourceChain: generateChain({ requestManagerAddress: '0xRequestManager' }),
        sourceAmount: generateTokenAmountData({
          token: generateToken({ address: '0xSourceToken' }),
          amount: '1',
        }),
      });
      const transfer = new TestTransfer(data);
      const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());

      await transfer.ensureTokenAllowance(signer);

      expect(tokenUtils.ensureTokenAllowance).toHaveBeenCalledTimes(1);
      expect(tokenUtils.ensureTokenAllowance).toHaveBeenLastCalledWith(
        signer,
        '0xSourceToken',
        '0xRequestManager',
        new UInt256('1'),
      );
    });
  });

  describe('sendRequestTransaction()', () => {
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
      const signer = new JsonRpcSigner(undefined, PROVIDER);

      await transfer.sendRequestTransaction(signer, SIGNER_ADDRESS);

      expect(requestManager.sendRequestTransaction).toHaveBeenCalledTimes(1);
      expect(requestManager.sendRequestTransaction).toHaveBeenLastCalledWith(
        signer,
        new UInt256('1'),
        2,
        '0xRequestManager',
        '0xSourceToken',
        '0xTargetToken',
        '0xTargetAccount',
        new UInt256('3'),
        new UInt256('4'),
      );
    });

    it('sets the request account and transaction hash', async () => {
      const transfer = new TestTransfer(DATA);
      Object.defineProperties(requestManager, {
        sendRequestTransaction: { value: vi.fn().mockResolvedValue('0xHash') },
      });

      expect(transfer.requestInformation?.requestAccount).toBeUndefined();
      expect(transfer.requestInformation?.transactionHash).toBeUndefined();

      await transfer.sendRequestTransaction(SIGNER, '0xSigner');

      expect(transfer.requestInformation?.requestAccount).toBe('0xSigner');
      expect(transfer.requestInformation?.transactionHash).toBe('0xHash');
    });
  });

  describe('waitForRequestEvent()', () => {
    it('fails when transaction hash has not been set', async () => {
      const data = generateTransferData({
        requestInformation: generateRequestInformationData({ transactionHash: '' }),
      });
      const transfer = new TestTransfer(data);

      return expect(transfer.waitForRequestEvent()).rejects.toThrow(
        'Attempt to get request event before sending transaction!',
      );
    });

    it('uses the stored request transaction hash', async () => {
      const data = generateTransferData({
        sourceChain: generateChain({
          rpcUrl: 'https://source.rpc',
          requestManagerAddress: '0xRequestManager',
        }),
        requestInformation: generateRequestInformationData({
          transactionHash: '0xHash',
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForRequestEvent();

      expect(requestManager.getRequestIdentifier).toHaveBeenCalledTimes(1);
      expect(requestManager.getRequestIdentifier).toHaveBeenLastCalledWith(
        'https://source.rpc',
        '0xRequestManager',
        '0xHash',
      );
    });
  });

  describe('waitForFulfillment()', () => {
    it('fails when request identifier has not been set', async () => {
      const data = generateTransferData({
        requestInformation: generateRequestInformationData({
          identifier: undefined,
        }),
      });
      const transfer = new TestTransfer(data);

      return expect(transfer.waitForFulfillment()).rejects.toThrow(
        'Attempting to wait for fulfillment without request identifier!',
      );
    });

    it('uses the correct parameters to wait for the request fill', async () => {
      const data = generateTransferData({
        targetChain: generateChain({
          rpcUrl: 'https://target.rpc',
          fillManagerAddress: '0xFillManager',
        }),
        requestInformation: generateRequestInformationData({
          identifier: generateUInt256Data('1'),
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForFulfillment();

      expect(fillManager.waitForFulfillment).toHaveBeenCalledTimes(1);
      expect(fillManager.waitForFulfillment).toHaveBeenLastCalledWith(
        'https://target.rpc',
        '0xFillManager',
        new UInt256('1'),
      );
    });

    it('uses the correct parameters to wait for the request expiration', async () => {
      const data = generateTransferData({
        sourceChain: generateChain({
          rpcUrl: 'https://source.rpc',
          requestManagerAddress: '0xRequestManager',
        }),
        requestInformation: generateRequestInformationData({
          identifier: generateUInt256Data('1'),
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForFulfillment();

      expect(requestManager.waitUntilRequestExpiresAndFail).toHaveBeenCalledTimes(1);
      expect(requestManager.waitUntilRequestExpiresAndFail).toHaveBeenLastCalledWith(
        'https://source.rpc',
        '0xRequestManager',
        new UInt256('1'),
      );
    });

    it('cancels waiting for exception when request got fulfilled', async () => {
      const cancelExpirationCheck = vi.fn();
      Object.defineProperty(requestManager, 'waitUntilRequestExpiresAndFail', {
        value: vi.fn().mockReturnValue({
          promise: new Promise(() => undefined),
          cancel: cancelExpirationCheck,
        }),
      });

      Object.defineProperty(fillManager, 'waitForFulfillment', {
        value: vi.fn().mockReturnValue({
          promise: new Promise<void>((resolve) => resolve()),
          cancel: () => undefined,
        }),
      });

      const data = generateTransferData({
        requestInformation: generateRequestInformationData({
          identifier: generateUInt256Data('1'),
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForFulfillment();

      expect(cancelExpirationCheck).toHaveBeenCalledOnce();
    });

    it('cancels waiting for fulfillment when request has expired', async () => {
      const cancelFulfillmentCheck = vi.fn();
      Object.defineProperty(requestManager, 'waitUntilRequestExpiresAndFail', {
        value: vi.fn().mockReturnValue({
          promise: Promise.reject(),
          cancel: vi.fn(),
        }),
      });

      Object.defineProperty(fillManager, 'waitForFulfillment', {
        value: vi.fn().mockReturnValue({
          promise: new Promise(() => undefined),
          cancel: cancelFulfillmentCheck,
        }),
      });

      const data = generateTransferData({
        requestInformation: generateRequestInformationData({
          identifier: generateUInt256Data('1'),
        }),
      });
      const transfer = new TestTransfer(data);

      try {
        await transfer.waitForFulfillment();
      } catch {
        // Ignore on purpose
      }

      expect(cancelFulfillmentCheck).toHaveBeenCalledOnce();
    });

    it('sets transfer to be expired if expiration promise rejects with according error', async () => {
      Object.defineProperty(requestManager, 'waitUntilRequestExpiresAndFail', {
        value: vi.fn().mockReturnValue({
          promise: Promise.reject(new RequestExpiredError()),
          cancel: vi.fn(),
        }),
      });

      Object.defineProperty(fillManager, 'waitForFulfillment', {
        value: vi.fn().mockReturnValue({
          promise: new Promise(() => undefined),
          cancel: vi.fn(),
        }),
      });

      const data = generateTransferData({
        requestInformation: generateRequestInformationData({
          identifier: generateUInt256Data('1'),
        }),
      });
      const transfer = new TestTransfer(data);
      expect(transfer.expired).toBeFalsy();

      try {
        await transfer.waitForFulfillment();
      } catch {
        // Ignore on purpose
      }

      expect(transfer.expired).toBeTruthy();
    });
  });

  describe('withdraw', () => {
    it('fails if the transfer is not expired', () => {
      const data = generateTransferData({ expired: false });
      const transfer = new TestTransfer(data);
      const provider = new MockedEthereumProvider();

      return expect(transfer.withdraw(provider)).rejects.toThrow(
        'Can only withdraw transfer funds after request expired!',
      );
    });

    it('fails when request identifier has not been set', () => {
      const data = generateTransferData({
        expired: true,
        requestInformation: generateRequestInformationData({ identifier: undefined }),
      });
      const transfer = new TestTransfer(data);
      const provider = new MockedEthereumProvider();

      return expect(transfer.withdraw(provider)).rejects.toThrow(
        'Attempting to withdraw without request identifier!',
      );
    });

    it('fails when no signer is available', () => {
      const data = generateTransferData({
        expired: true,
        requestInformation: generateRequestInformationData({ identifier: '1' }),
      });
      const transfer = new TestTransfer(data);
      const provider = new MockedEthereumProvider({ signer: undefined });

      return expect(transfer.withdraw(provider)).rejects.toThrow(
        'Can not withdraw without connected wallet!',
      );
    });

    it('triggers a chain switch if providers connected chain does not match source chain', async () => {
      const data = generateTransferData({
        expired: true,
        requestInformation: generateRequestInformationData({ identifier: '1' }),
        sourceChain: generateChain({ identifier: 1 }),
      });
      const transfer = new TestTransfer(data);
      const provider = new MockedEthereumProvider({ chainId: 2, signer: SIGNER });

      await transfer.withdraw(provider);

      expect(provider.switchChain).toHaveBeenCalledOnce();
    });

    it('uses the correct parameters to make the withdraw', async () => {
      const data = generateTransferData({
        expired: true,
        requestInformation: generateRequestInformationData({ identifier: '1' }),
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
        signer,
        '0xRequestManager',
        new UInt256('1'),
      );
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
      const fulfillmentInformation = generateFulfillmentInformation();
      const expired = true;
      const withdrawn = true;
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
        fulfillmentInformation,
        expired,
        withdrawn,
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
      expect(encodedData.fulfillmentInformation).toMatchObject(fulfillmentInformation);
      expect(encodedData.expired).toBe(true);
      expect(encodedData.withdrawn).toBe(true);
      expect(encodedData.steps).toMatchObject(steps);
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
});
