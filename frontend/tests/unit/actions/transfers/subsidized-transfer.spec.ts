import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { flushPromises } from '@vue/test-utils';

import type { SubsidizedTransferData } from '@/actions/transfers';
import { SubsidizedTransfer } from '@/actions/transfers';
import * as requestManager from '@/services/transactions/request-manager';
import * as tokenUtils from '@/services/transactions/token';
import * as transactionUtils from '@/services/transactions/utils';
import type { IEthereumProvider } from '@/services/web3-provider';
import { UInt256 } from '@/types/uint-256';
import {
  generateChain,
  generateRequestInformationData,
  generateStepData,
  generateSubsidizedTransferData,
  generateToken,
  generateTokenAmountData,
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

class TestSubsidizedTransfer extends SubsidizedTransfer {
  public ensureTokenAllowance(provider: IEthereumProvider) {
    return super.ensureTokenAllowance(provider);
  }

  public sendRequestTransaction(provider: IEthereumProvider) {
    return super.sendRequestTransaction(provider);
  }
}

describe('SubsidizedTransfer', () => {
  beforeEach(() => {
    global.Date.now = vi.fn();

    Object.defineProperties(tokenUtils, {
      ensureTokenAllowance: { value: vi.fn().mockResolvedValue(undefined) },
      isAllowanceApproved: { value: vi.fn().mockResolvedValue(true) },
    });

    Object.defineProperties(requestManager, {
      sendRequestTransaction: { value: vi.fn().mockResolvedValue('0xHash') },
      getRequestData: {
        value: vi.fn().mockResolvedValue({
          withdrawn: false,
        }),
      },
    });

    Object.defineProperties(transactionUtils, {
      getCurrentBlockNumber: { value: vi.fn().mockResolvedValue(0) },
    });
  });

  afterEach(() => {
    flushPromises();
  });

  describe('ensureTokenAllowance()', async () => {
    it('makes a call to set the allowance for the FeeSub contract', async () => {
      const feeSubAddress = '0xFeeSub';
      const data = generateSubsidizedTransferData({
        fees: generateTokenAmountData({ amount: '2' }),
        sourceChain: generateChain({ requestManagerAddress: '0xRequestManager', feeSubAddress }),
        sourceAmount: generateTokenAmountData({
          token: generateToken({ address: '0xSourceToken' }),
          amount: '1',
        }),
        feeSubAddress,
      });
      const transfer = new TestSubsidizedTransfer(data);
      const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());
      const provider = new MockedEthereumProvider({
        signer: signer,
        signerAddress: data.requestInformation?.requestAccount,
      });

      await transfer.ensureTokenAllowance(provider);

      expect(tokenUtils.ensureTokenAllowance).toHaveBeenCalledTimes(1);
      expect(tokenUtils.ensureTokenAllowance).toHaveBeenLastCalledWith(
        provider,
        '0xSourceToken',
        feeSubAddress,
        new UInt256('1'),
      );
      expect(tokenUtils.isAllowanceApproved).toHaveBeenCalledTimes(1);
      expect(tokenUtils.isAllowanceApproved).toHaveBeenLastCalledWith(
        provider,
        '0xSourceToken',
        data.requestInformation?.requestAccount,
        feeSubAddress,
        new UInt256('1'),
      );
    });
  });

  describe('sendRequestTransaction()', () => {
    it('calls the request function on the FeeSub contract', async () => {
      const feeSubAddress = '0xFeeSub';
      const data = generateSubsidizedTransferData({
        sourceChain: generateChain({ requestManagerAddress: '0xRequestManager', feeSubAddress }),
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
        feeSubAddress,
      });
      const transfer = new TestSubsidizedTransfer(data);
      const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());
      const provider = new MockedEthereumProvider({
        signer: signer,
        signerAddress: data.requestInformation?.requestAccount,
      });

      await transfer.sendRequestTransaction(provider);

      expect(requestManager.sendRequestTransaction).toHaveBeenCalledTimes(1);
      expect(requestManager.sendRequestTransaction).toHaveBeenLastCalledWith(
        provider,
        new UInt256('1'),
        2,
        feeSubAddress,
        '0xSourceToken',
        '0xTargetToken',
        '0xTargetAccount',
        new UInt256('3'),
      );
    });
  });

  describe('withdraw', () => {
    it('uses the FeeSub contract to withdraw', async () => {
      const feeSubAddress = '0xFeeSub';
      const identifier = getRandomString();
      const data = generateSubsidizedTransferData({
        expired: true,
        requestInformation: generateRequestInformationData({
          identifier,
        }),
        sourceChain: generateChain({
          identifier: 1,
          requestManagerAddress: '0xRequestManager',
          feeSubAddress,
        }),
      });
      const transfer = new TestSubsidizedTransfer(data);
      const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());
      const provider = new MockedEthereumProvider({ chainId: 1, signer });

      await transfer.withdraw(provider);

      expect(requestManager.withdrawRequest).toHaveBeenCalledOnce();
      expect(requestManager.withdrawRequest).toHaveBeenLastCalledWith(
        provider,
        feeSubAddress,
        identifier,
      );
    });
  });

  describe('encode()', () => {
    it('serializes all data to persist the whole transfer', () => {
      const feeSubAddress = getRandomEthereumAddress();
      const sourceChain = generateChain({ feeSubAddress });
      const sourceAmount = generateTokenAmountData();
      const targetChain = generateChain();
      const targetAmount = generateTokenAmountData();
      const targetAccount = getRandomEthereumAddress();
      const validityPeriod = generateUInt256Data();
      const fees = generateTokenAmountData({ amount: '0' });
      const date = 1652688517448;
      const requestInformation = generateRequestInformationData();
      const expired = true;
      const withdrawn = true;
      const claimCount = getRandomNumber();
      const steps = [generateStepData()];
      const data: SubsidizedTransferData = {
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
        feeSubAddress,
      };
      const transfer = new TestSubsidizedTransfer(data);

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
      expect(encodedData.feeSubAddress).toBe(feeSubAddress);
    });

    it('can be used to re-instantiate subsidized transfer again', () => {
      const data = generateSubsidizedTransferData();
      const transfer = new TestSubsidizedTransfer(data);

      const encodedData = transfer.encode();
      const newTransfer = new TestSubsidizedTransfer(encodedData);
      const newEncodedData = newTransfer.encode();

      expect(encodedData).toMatchObject(newEncodedData);
    });
  });
});
