import type { JsonRpcSigner } from '@ethersproject/providers';

import type { StepData } from '@/actions/steps';
import { MultiStepAction, Step } from '@/actions/steps';
import { waitForFulfillment } from '@/services/transactions/fill-manager';
import {
  getRequestIdentifier,
  sendRequestTransaction,
  waitUntilRequestExpiresAndFail,
} from '@/services/transactions/request-manager';
import { ensureTokenAllowance } from '@/services/transactions/token';
import type { Chain, EthereumAddress } from '@/types/data';
import type { Encodable } from '@/types/encoding';
import type { EthereumAmount, TokenAmountData } from '@/types/token-amount';
import { TokenAmount } from '@/types/token-amount';
import type { UInt256Data } from '@/types/uint-256';
import { UInt256 } from '@/types/uint-256';

import type { FulfillmentInformation } from './fulfillment-information';
import type { RequestInformationData } from './request-information';
import { RequestInformation } from './request-information';

const STEPS_DATA = [
  { identifier: 'ensureTokenAllowance', label: 'Ensure token allowance' },
  { identifier: 'sendRequestTransaction', label: 'Please confirm the transaction' },
  { identifier: 'waitForRequestEvent', label: 'Waiting for transaction receipt' },
  { identifier: 'waitForFulfillment', label: 'Request is being fulfilled' },
];

export class Transfer extends MultiStepAction implements Encodable<TransferData> {
  readonly sourceChain: Chain;
  readonly sourceAmount: TokenAmount;
  readonly targetChain: Chain;
  readonly targetAmount: TokenAmount;
  readonly targetAccount: EthereumAddress;
  readonly validityPeriod: UInt256;
  readonly fees: TokenAmount;
  readonly date: Date;
  private _requestInformation?: RequestInformation;
  private _fulfillmentInformation?: FulfillmentInformation;

  constructor(data: TransferData) {
    super((data.steps ?? STEPS_DATA).map((data) => new Step(data)));

    this.sourceChain = data.sourceChain;
    this.sourceAmount = new TokenAmount(data.sourceAmount);
    this.targetChain = data.targetChain;
    this.targetAmount = new TokenAmount(data.targetAmount);
    this.targetAccount = data.targetAccount;
    this.validityPeriod = new UInt256(data.validityPeriod);
    this.fees = new TokenAmount(data.fees);
    this.date = new Date(data.date);
    this._requestInformation = data.requestInformation
      ? new RequestInformation(data.requestInformation)
      : undefined;
    this._fulfillmentInformation = data.fulfillmentInformation;
  }

  static new(
    sourceChain: Chain,
    sourceAmount: TokenAmount,
    targetChain: Chain,
    targetAmount: TokenAmount,
    targetAccount: EthereumAddress,
    validityPeriod: UInt256,
    fees: EthereumAmount,
  ): Transfer {
    return new this({
      sourceChain,
      sourceAmount: sourceAmount.encode(),
      targetChain,
      targetAmount: targetAmount.encode(),
      targetAccount,
      validityPeriod: validityPeriod.encode(),
      fees: fees.encode(),
      date: Date.now(),
    });
  }

  get requestInformation(): RequestInformation | undefined {
    return this._requestInformation;
  }

  get fulfillmentInformation(): FulfillmentInformation | undefined {
    return this._fulfillmentInformation;
  }

  protected getStepMethods(
    signer: JsonRpcSigner,
    signerAddress: EthereumAddress,
  ): Record<string, CallableFunction> {
    // For backwards compatibility, never remove an entry, only add new ones.
    return {
      ensureTokenAllowance: () => this.ensureTokenAllowance(signer),
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
      sourceChain: this.sourceChain,
      sourceAmount: this.sourceAmount.encode(),
      targetChain: this.targetChain,
      targetAmount: this.targetAmount.encode(),
      targetAccount: this.targetAccount,
      validityPeriod: this.validityPeriod.encode(),
      fees: this.fees.encode(),
      date: this.date.getTime(),
      steps: this.steps.map((step) => step.encode()),
      requestInformation: this._requestInformation?.encode(),
      fulfillmentInformation: this.fulfillmentInformation,
    };
  }

  protected async ensureTokenAllowance(signer: JsonRpcSigner): Promise<void> {
    await ensureTokenAllowance(
      signer,
      this.sourceAmount.token.address,
      this.sourceChain.requestManagerAddress,
      this.sourceAmount.uint256,
    );
  }

  protected async sendRequestTransaction(
    signer: JsonRpcSigner,
    signerAddress: EthereumAddress,
  ): Promise<void> {
    const transactionHash = await sendRequestTransaction(
      signer,
      this.sourceAmount.uint256,
      this.targetChain.identifier,
      this.sourceChain.requestManagerAddress,
      this.sourceAmount.token.address,
      this.targetAmount.token.address,
      this.targetAccount,
      this.validityPeriod,
      this.fees.uint256,
    );

    this._requestInformation = new RequestInformation({
      transactionHash,
      requestAccount: signerAddress,
    });
  }

  protected async waitForRequestEvent(): Promise<void> {
    if (!this._requestInformation?.transactionHash) {
      throw new Error('Attempt to get request event before sending transaction!');
    }

    const identifier = await getRequestIdentifier(
      this.sourceChain.rpcUrl,
      this.sourceChain.requestManagerAddress,
      this._requestInformation.transactionHash,
    );

    this._requestInformation.setIdentifier(identifier);
  }

  protected async waitForFulfillment(): Promise<void> {
    if (!this._requestInformation?.identifier) {
      throw new Error('Attempting to wait for fulfillment without request identifier!');
    }

    const { promise: fulfillmentPromise, cancel: cancelFulfillmentChecks } = waitForFulfillment(
      this.targetChain.rpcUrl,
      this.targetChain.fillManagerAddress,
      this._requestInformation.identifier,
    );

    const { promise: expirationPromise, cancel: cancelExpirationCheck } =
      waitUntilRequestExpiresAndFail(
        this.sourceChain.rpcUrl,
        this.sourceChain.requestManagerAddress,
        this._requestInformation.identifier,
      );

    try {
      await Promise.race([fulfillmentPromise, expirationPromise]);
      // TODO: set this.fulfillmentInformation
    } finally {
      cancelFulfillmentChecks();
      cancelExpirationCheck();
    }
  }
}

export type TransferData = {
  sourceChain: Chain;
  sourceAmount: TokenAmountData;
  targetChain: Chain;
  targetAmount: TokenAmountData;
  targetAccount: EthereumAddress;
  validityPeriod: UInt256Data;
  fees: TokenAmountData;
  date: number;
  steps?: Array<StepData>;
  requestInformation?: RequestInformationData;
  fulfillmentInformation?: FulfillmentInformation;
};
