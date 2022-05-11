import type { JsonRpcSigner } from '@ethersproject/providers';
import { JsonRpcProvider } from '@ethersproject/providers';

import { MultiStepAction, Step, StepData } from '@/actions/steps';
import { waitForFulfillment } from '@/services/transactions/fill-manager';
import {
  getRequestIdentifier,
  sendRequestTransaction,
} from '@/services/transactions/request-manager';
import type { Chain, EthereumAddress, Token } from '@/types/data';
import type { Encodable } from '@/types/encoding';
import type { TokenAmountData } from '@/types/token-amount';
import { TokenAmount } from '@/types/token-amount';
import type { UInt256Data } from '@/types/uint-256';
import { UInt256 } from '@/types/uint-256';

import type { RequestFillMetadata } from './request-fill-metadata';
import type { RequestMetadataData } from './request-metadata';
import { RequestMetadata } from './request-metadata';

const STEPS_DATA = [
  { identifier: 'sendRequestTransaction', label: 'Please confirm your request on Metamask' },
  { identifier: 'waitForRequestEvent', label: 'Waiting for transaction receipt' },
  { identifier: 'waitForFulfillment', label: 'Request is being fulfilled' },
];

export class Transfer extends MultiStepAction implements Encodable<TransferData> {
  readonly amount: TokenAmount;
  readonly sourceChain: Chain;
  readonly sourceToken: Token;
  readonly targetChain: Chain;
  readonly targetToken: Token;
  readonly targetAccount: EthereumAddress;
  readonly validityPeriod: UInt256;
  readonly fees: UInt256;
  private _requestMetadata?: RequestMetadata;
  private _requestFillMetadata?: RequestFillMetadata;

  constructor(data: TransferData) {
    super((data.steps ?? STEPS_DATA).map((data) => new Step(data)));

    this.amount = new TokenAmount(data.amount);
    this.sourceChain = data.sourceChain;
    this.sourceToken = data.sourceToken;
    this.targetChain = data.targetChain;
    this.targetToken = data.targetToken;
    this.targetAccount = data.targetAccount;
    this.validityPeriod = new UInt256(data.validityPeriod);
    this.fees = new UInt256(data.fees);
    this._requestMetadata = data.requestMetadata
      ? new RequestMetadata(data.requestMetadata)
      : undefined;
    this._requestFillMetadata = data.requestFillMetadata;
  }

  static new(
    amount: TokenAmount,
    sourceChain: Chain,
    sourceToken: Token,
    targetChain: Chain,
    targetToken: Token,
    targetAccount: EthereumAddress,
    validityPeriod: UInt256,
    fees: UInt256,
  ): Transfer {
    return new this({
      amount: amount.encode(),
      sourceChain,
      sourceToken,
      targetChain,
      targetToken,
      targetAccount,
      validityPeriod: validityPeriod.encode(),
      fees: fees.encode(),
    });
  }

  get requestMetadata(): RequestMetadata | undefined {
    return this._requestMetadata;
  }

  get requestFillMetadata(): RequestFillMetadata | undefined {
    return this._requestFillMetadata;
  }

  protected getStepMethods(
    signer: JsonRpcSigner,
    signerAddress: EthereumAddress,
  ): Record<string, CallableFunction> {
    // For backwards compatibility, never remove an entry, only add new ones.
    return {
      sendRequestTransaction: () => this.sendRequestTransaction(signer, signerAddress),
      waitForRequestEvent: () => this.waitForRequestEvent(),
      waitForFulfillment: () => this.waitForFulfillment(),
    };
  }

  public async execute(signer: JsonRpcSigner, signerAddress: EthereumAddress): Promise<void> {
    const methods = this.getStepMethods(signer, signerAddress);
    return super.executeSteps(methods);
  }

  public encode(): TransferData {
    return {
      amount: this.amount.encode(),
      sourceChain: this.sourceChain,
      sourceToken: this.sourceToken,
      targetChain: this.targetChain,
      targetToken: this.targetToken,
      targetAccount: this.targetAccount,
      validityPeriod: this.validityPeriod.encode(),
      fees: this.fees.encode(),
      steps: this.steps.map((step) => step.encode()),
      requestMetadata: this._requestMetadata?.encode(),
      requestFillMetadata: this.requestFillMetadata,
    };
  }

  protected async sendRequestTransaction(
    signer: JsonRpcSigner,
    signerAddress: EthereumAddress,
  ): Promise<void> {
    const transactionHash = await sendRequestTransaction(
      signer,
      this.amount.uint256,
      this.targetChain.identifier,
      this.sourceChain.requestManagerAddress,
      this.sourceToken.address,
      this.targetToken.address,
      this.targetAccount,
      this.validityPeriod,
      this.fees,
    );

    this._requestMetadata = new RequestMetadata({
      transactionHash,
      requestAccount: signerAddress,
    });
  }

  protected async waitForRequestEvent(): Promise<void> {
    if (!this._requestMetadata?.transactionHash) {
      throw new Error('Attempt to get request event before sending transaction!');
    }

    const provider = new JsonRpcProvider(this.sourceChain.rpcUrl);
    const identifier = await getRequestIdentifier(
      provider,
      this.sourceChain.requestManagerAddress,
      this._requestMetadata.transactionHash,
    );

    this._requestMetadata.setIdentifier(identifier);
  }

  protected async waitForFulfillment(): Promise<void> {
    if (!this._requestMetadata?.identifier) {
      throw new Error('Attempting to wait for fulfillment without request identifier!');
    }

    const provider = new JsonRpcProvider(this.targetChain.rpcUrl);

    await waitForFulfillment(
      provider,
      this._requestMetadata.identifier,
      this.targetChain.fillManagerAddress,
    );

    // TODO: set this.requestFillMetadata
  }
}

export type TransferData = {
  amount: TokenAmountData;
  sourceChain: Chain;
  sourceToken: Token;
  targetChain: Chain;
  targetToken: Token;
  targetAccount: EthereumAddress;
  validityPeriod: UInt256Data;
  fees: UInt256Data;
  steps?: Array<StepData>;
  requestMetadata?: RequestMetadataData;
  requestFillMetadata?: RequestFillMetadata;
};
