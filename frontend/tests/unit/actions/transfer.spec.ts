/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';

import { Step } from '@/actions/steps';
import { Transfer, TransferData } from '@/actions/transfer';
import * as fillManager from '@/services/transactions/fill-manager';
import * as requestManager from '@/services/transactions/request-manager';
import type { EthereumAddress } from '@/types/data';
import {
  generateChain,
  generateRequestTransactionMetadata,
  generateToken,
  generateTransferData,
} from '~/utils/data_generators';

vi.mock('@ethersproject/providers');
vi.mock('@/services/transactions/fill-manager');
vi.mock('@/services/transactions/request-manager');

class TestTransfer extends Transfer {
  public getStepMethods(signer: JsonRpcSigner, signerAddress: EthereumAddress) {
    return super.getStepMethods(signer, signerAddress);
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
const SIGNER = new JsonRpcSigner(undefined, new JsonRpcProvider());
const SIGNER_ADDRESS = '0xSigner';

describe('transfer', () => {
  beforeEach(() => {
    requestManager!.sendRequestTransaction = vi.fn().mockResolvedValue('0xHash');
    requestManager!.getRequestIdentifier = vi.fn().mockResolvedValue(1);
    fillManager!.waitForFulfillment = vi.fn().mockResolvedValue(undefined);
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

      expect(requestManager.sendRequestTransaction).toHaveBeenCalledTimes(1);
      expect(requestManager.getRequestIdentifier).toHaveBeenCalledTimes(1);
      expect(fillManager!.waitForFulfillment).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendRequestTransaction()', () => {
    it('calls the transfer function on the request manager contract', async () => {
      const data = generateTransferData({
        amount: 1,
        sourceChain: generateChain({ requestManagerAddress: '0xRequestManager' }),
        sourceToken: generateToken({ address: '0xSourceToken' }),
        targetChain: generateChain({ identifier: 2 }),
        targetToken: generateToken({ address: '0xTargetToken' }),
        targetAccount: '0xTargetAccount',
        validityPeriod: 3,
        fees: 4,
      });
      const transfer = new TestTransfer(data);
      const signer = new JsonRpcSigner(undefined, new JsonRpcProvider());

      await transfer.sendRequestTransaction(signer, SIGNER_ADDRESS);

      expect(requestManager.sendRequestTransaction).toHaveBeenCalledTimes(1);
      expect(requestManager.sendRequestTransaction).toHaveBeenLastCalledWith(
        signer,
        1,
        2,
        '0xRequestManager',
        '0xSourceToken',
        '0xTargetToken',
        '0xTargetAccount',
        3,
        4,
      );
    });

    it('sets the request account and transaction hash', async () => {
      const transfer = new TestTransfer(DATA);
      requestManager!.sendRequestTransaction = vi.fn().mockResolvedValue('0xHash');

      expect(transfer.requestTransactionMetadata?.requestAccount).toBeUndefined();
      expect(transfer.requestTransactionMetadata?.transactionHash).toBeUndefined();

      await transfer.sendRequestTransaction(SIGNER, '0xSigner');

      expect(transfer.requestTransactionMetadata?.requestAccount).toBe('0xSigner');
      expect(transfer.requestTransactionMetadata?.transactionHash).toBe('0xHash');
    });
  });

  describe('waitForRequestEvent()', () => {
    it('fails when transaction hash has not been set', async () => {
      const data = generateTransferData({
        requestTransactionMetadata: generateRequestTransactionMetadata({ transactionHash: '' }),
      });
      const transfer = new TestTransfer(data);

      return expect(transfer.waitForRequestEvent()).rejects.toThrow(
        'Attempt to get request event before sending transaction!',
      );
    });

    it('connects to the source chain', async () => {
      const data = generateTransferData({
        sourceChain: generateChain({ rpcUrl: 'https://source.rpc' }),
        requestTransactionMetadata: generateRequestTransactionMetadata(),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForRequestEvent();

      expect(JsonRpcProvider).toHaveBeenCalledTimes(1);
      expect(JsonRpcProvider).toHaveBeenLastCalledWith('https://source.rpc');
    });

    it('uses the stored request transaction hash', async () => {
      const data = generateTransferData({
        sourceChain: generateChain({ requestManagerAddress: '0xRequestManager' }),
        requestTransactionMetadata: generateRequestTransactionMetadata({
          transactionHash: '0xHash',
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForRequestEvent();

      expect(requestManager.getRequestIdentifier).toHaveBeenCalledTimes(1);
      expect(requestManager.getRequestIdentifier).toHaveBeenLastCalledWith(
        expect.any(JsonRpcProvider),
        '0xRequestManager',
        '0xHash',
      );
    });
  });

  describe('waitForFulfillment()', () => {
    it('fails when request identifier has not been set', async () => {
      const data = generateTransferData({
        requestTransactionMetadata: generateRequestTransactionMetadata({
          identifier: undefined,
        }),
      });
      const transfer = new TestTransfer(data);

      return expect(transfer.waitForFulfillment()).rejects.toThrow(
        'Attempting to wait for fulfillment without request identifier!',
      );
    });

    it('connects to the target chain', async () => {
      const data = generateTransferData({
        targetChain: generateChain({ rpcUrl: 'https://target.rpc' }),
        requestTransactionMetadata: generateRequestTransactionMetadata({
          identifier: 1,
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForFulfillment();

      expect(JsonRpcProvider).toHaveBeenCalledTimes(1);
      expect(JsonRpcProvider).toHaveBeenLastCalledWith('https://target.rpc');
    });

    it('uses the correct parameters to wait for the request fill', async () => {
      const data = generateTransferData({
        targetChain: generateChain({ fillManagerAddress: '0xFillManager' }),
        requestTransactionMetadata: generateRequestTransactionMetadata({
          identifier: 1,
        }),
      });
      const transfer = new TestTransfer(data);

      await transfer.waitForFulfillment();

      expect(fillManager.waitForFulfillment).toHaveBeenCalledTimes(1);
      expect(fillManager.waitForFulfillment).toHaveBeenLastCalledWith(
        expect.any(JsonRpcProvider),
        1,
        '0xFillManager',
      );
    });
  });

  describe('encode()', () => {
    it('serializes all data to persist the whole transfer', () => {
      const data: TransferData = {
        amount: 1,
        sourceChain: {
          identifier: 1,
          name: 'Source Chain',
          rpcUrl: 'https://source.rpc',
          requestManagerAddress: '0xSourceRequestManager',
          fillManagerAddress: '0xSourceFillManager',
          explorerTransactionUrl: 'https://source/tx',
        },
        sourceToken: {
          address: '0xSourceToken',
          symbol: 'SOT',
          decimals: 15,
        },
        targetChain: {
          identifier: 2,
          name: 'Target Chain',
          rpcUrl: 'https://target.rpc',
          requestManagerAddress: '0xTargetRequestManager',
          fillManagerAddress: '0xTargetFillManager',
          explorerTransactionUrl: 'https://target/tx',
        },
        targetToken: {
          address: '0xTargetToken',
          symbol: 'TAT',
          decimals: 18,
        },
        targetAccount: '0TargetAccount',
        validityPeriod: 3,
        fees: 4,
        requestTransactionMetadata: {
          identifier: 5,
          requestAccount: '0xRequestAccount',
          transactionHash: '0xRequestTransactionHash',
        },
        requestFillTransactionMetadata: {
          fillerAccount: '0xFillerAccount',
          transactionHash: '0xRequestFillTransactionHash',
        },
        steps: [
          new Step({
            identifier: 'stepIdentifier',
            label: 'step label',
            active: false,
            completed: false,
            errorMessage: 'test error message',
          }),
        ],
      };
      const transfer = new TestTransfer(data);

      const encodedData = transfer.encode();

      expect(encodedData.amount).toBe(1);
      expect(encodedData.sourceChain.identifier).toBe(1);
      expect(encodedData.sourceChain.name).toBe('Source Chain');
      expect(encodedData.sourceChain.rpcUrl).toBe('https://source.rpc');
      expect(encodedData.sourceChain.requestManagerAddress).toBe('0xSourceRequestManager');
      expect(encodedData.sourceChain.fillManagerAddress).toBe('0xSourceFillManager');
      expect(encodedData.sourceChain.explorerTransactionUrl).toBe('https://source/tx');
      expect(encodedData.sourceToken.address).toBe('0xSourceToken');
      expect(encodedData.sourceToken.symbol).toBe('SOT');
      expect(encodedData.sourceToken.decimals).toBe(15);
      expect(encodedData.targetChain.identifier).toBe(2);
      expect(encodedData.targetChain.name).toBe('Target Chain');
      expect(encodedData.targetChain.rpcUrl).toBe('https://target.rpc');
      expect(encodedData.targetChain.requestManagerAddress).toBe('0xTargetRequestManager');
      expect(encodedData.targetChain.fillManagerAddress).toBe('0xTargetFillManager');
      expect(encodedData.targetChain.explorerTransactionUrl).toBe('https://target/tx');
      expect(encodedData.targetToken.address).toBe('0xTargetToken');
      expect(encodedData.targetToken.symbol).toBe('TAT');
      expect(encodedData.targetToken.decimals).toBe(18);
      expect(encodedData.targetAccount).toBe('0TargetAccount');
      expect(encodedData.validityPeriod).toBe(3);
      expect(encodedData.fees).toBe(4);
      expect(encodedData.requestTransactionMetadata?.identifier).toBe(5);
      expect(encodedData.requestTransactionMetadata?.requestAccount).toBe('0xRequestAccount');
      expect(encodedData.requestTransactionMetadata?.transactionHash).toBe(
        '0xRequestTransactionHash',
      );
      expect(encodedData.requestFillTransactionMetadata?.fillerAccount).toBe('0xFillerAccount');
      expect(encodedData.requestFillTransactionMetadata?.transactionHash).toBe(
        '0xRequestFillTransactionHash',
      );
      expect(encodedData.steps?.[0].identifier).toBe('stepIdentifier');
      expect(encodedData.steps?.[0].label).toBe('step label');
      expect(encodedData.steps?.[0].active).toBe(false);
      expect(encodedData.steps?.[0].completed).toBe(false);
      expect(encodedData.steps?.[0].errorMessage).toBe('test error message');
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
