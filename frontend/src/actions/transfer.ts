import type { JsonRpcSigner } from '@ethersproject/providers';
import { JsonRpcProvider } from '@ethersproject/providers';

import { MultiStepAction, Step, StepData } from '@/actions/steps';
import { waitForFulfillment } from '@/services/transactions/fill-manager';
import {
  getRequestIdentifier,
  makeRequestTransaction,
} from '@/services/transactions/request-manager';
import type { Chain, EthereumAddress, Token } from '@/types/data';
import type { Encodable } from '@/types/encoding';

const STEPS_DATA = [
  { identifier: 'makeRequestTransaction', label: 'Please confirm your request on Metamask' },
  { identifier: 'waitForRequestEvent', label: 'Waiting for transaction receipt' },
  { identifier: 'waitForFulfillment', label: 'Request is being fulfilled' },
];

export class Transfer extends MultiStepAction implements Encodable<TransferData> {
  readonly amount: number; // in Wei
  readonly sourceChain: Chain;
  readonly sourceToken: Token;
  readonly targetChain: Chain;
  readonly targetToken: Token;
  readonly targetAccount: EthereumAddress;
  readonly validityPeriod: number;
  readonly fees: number;
  private _requestTransactionMetadata?: RequestTransactionMetadata;
  private _requestFillTransactionMetadata?: RequestFillTransactionMetadata;

  constructor(data: TransferData) {
    super((data.steps ?? STEPS_DATA).map((data) => new Step(data)));

    this.amount = data.amount;
    this.sourceChain = data.sourceChain;
    this.sourceToken = data.sourceToken;
    this.targetChain = data.targetChain;
    this.targetToken = data.targetToken;
    this.targetAccount = data.targetAccount;
    this.validityPeriod = data.validityPeriod;
    this.fees = data.fees;
    this._requestTransactionMetadata = data.requestTransactionMetadata;
    this._requestFillTransactionMetadata = data.requestFillTransactionMetadata;
  }

  get requestTransactionMetadata(): RequestTransactionMetadata | undefined {
    return this._requestTransactionMetadata;
  }

  get requestFillTransactionMetadata(): RequestFillTransactionMetadata | undefined {
    return this._requestFillTransactionMetadata;
  }

  protected getStepMethods(
    signer: JsonRpcSigner,
    signerAddress: EthereumAddress,
  ): Record<string, CallableFunction> {
    // For backwards compatibility, never remove an entry, only add new ones.
    return {
      makeRequestTransaction: () => this.makeRequestTransaction(signer, signerAddress),
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
      amount: this.amount,
      sourceChain: this.sourceChain,
      sourceToken: this.sourceToken,
      targetChain: this.targetChain,
      targetToken: this.targetToken,
      targetAccount: this.targetAccount,
      validityPeriod: this.validityPeriod,
      fees: this.fees,
      steps: this.steps.map((step) => step.encode()),
      requestTransactionMetadata: this.requestTransactionMetadata,
      requestFillTransactionMetadata: this.requestFillTransactionMetadata,
    };
  }

  protected async makeRequestTransaction(
    signer: JsonRpcSigner,
    signerAddress: EthereumAddress,
  ): Promise<void> {
    const transactionHash = await makeRequestTransaction(
      signer,
      this.amount,
      this.targetChain.identifier,
      this.sourceChain.requestManagerAddress,
      this.sourceToken.address,
      this.targetToken.address,
      this.targetAccount,
      this.validityPeriod,
      this.fees,
    );

    this._requestTransactionMetadata = { transactionHash, requestAccount: signerAddress };
  }

  protected async waitForRequestEvent(): Promise<void> {
    if (!this.requestTransactionMetadata?.transactionHash) {
      throw new Error('Attempt to get request event before sending transaction!');
    }

    const provider = new JsonRpcProvider(this.sourceChain.rpcUrl);
    const identifier = await getRequestIdentifier(
      provider,
      this.sourceChain.requestManagerAddress,
      this.requestTransactionMetadata.transactionHash,
    );

    this._requestTransactionMetadata = { ...this.requestTransactionMetadata, identifier };
  }

  protected async waitForFulfillment(): Promise<void> {
    if (!this.requestTransactionMetadata?.identifier) {
      throw new Error('Attempting to wait for fulfillment without request identifier!');
    }

    const provider = new JsonRpcProvider(this.targetChain.rpcUrl);

    await waitForFulfillment(
      provider,
      this.requestTransactionMetadata.identifier,
      this.targetChain.fillManagerAddress,
    );

    // TODO: set this.requestFillMetadata
  }
}

export type RequestTransactionMetadata = {
  identifier?: number;
  requestAccount: EthereumAddress;
  transactionHash: string;
};

export type RequestFillTransactionMetadata = {
  fillerAccount: EthereumAddress;
  transactionHash: string;
};

export type TransferData = {
  amount: number; // in Wei
  sourceChain: Chain;
  sourceToken: Token;
  targetChain: Chain;
  targetToken: Token;
  targetAccount: EthereumAddress;
  validityPeriod: number; // TODO: maybe make this a date? Timezone issue...
  fees: number;
  steps?: Array<StepData>;
  requestTransactionMetadata?: RequestTransactionMetadata;
  requestFillTransactionMetadata?: RequestFillTransactionMetadata;
};
