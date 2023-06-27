import type { StepData } from '@/actions/steps';
import { MultiStepAction, Step } from '@/actions/steps';
import { waitForFulfillment } from '@/services/transactions/fill-manager';
import {
  failWhenRequestExpires,
  getRequestData,
  getRequestInformation,
  listenOnClaimCountChange,
  RequestExpiredError,
  sendRequestTransaction,
  withdrawRequest,
} from '@/services/transactions/request-manager';
import { ensureTokenAllowance, isAllowanceApproved } from '@/services/transactions/token';
import {
  getConfirmationTimeBlocksForChain,
  getCurrentBlockNumber,
} from '@/services/transactions/utils';
import type { IEthereumProvider } from '@/services/web3-provider';
import type { Chain, EthereumAddress } from '@/types/data';
import type { Encodable } from '@/types/encoding';
import type { TokenAmountData } from '@/types/token-amount';
import { TokenAmount } from '@/types/token-amount';
import type { UInt256Data } from '@/types/uint-256';
import { UInt256 } from '@/types/uint-256';

import type { AllowanceInformationData } from './allowance-information';
import { AllowanceInformation } from './allowance-information';
import type { RequestFulfillmentData } from './request-fulfillment';
import { RequestFulfillment } from './request-fulfillment';
import type { RequestInformationData } from './request-information';
import { RequestInformation } from './request-information';

const STEPS_DATA = [
  { identifier: 'ensureTokenAllowance', label: 'Ensure token allowance' },
  { identifier: 'sendRequestTransaction', label: 'Please confirm the transaction' },
  { identifier: 'waitForRequestEvent', label: 'Waiting for transaction receipt' },
  { identifier: 'waitForFulfillment', label: 'Request is being fulfilled' },
];

/**
 * A transfer is used to exchange tokens from one blockchain network to another.
 *
 * This class represents the central core business logic of the whole
 * application. This means it must be the most protected, stable an reliable
 * code of the whole application. After all everything this application does is
 * related to transfers. In result all external dependencies should be kept as
 * far away as possible from here. Everything this class depends on must be very
 * stable. This stability can be achieved with different approaches
 * (dependency-inversion, open-closed-principle, ...).
 *
 * A transfer itself only holds the data relevant for a specific transfer and
 * defines the basic flow of the protocol. It MUST NEVER implement any details
 * of the protocol which are focus of modules in more "fragile" dependency
 * layers. You could argue a transfer does not even know about the concepts of
 * blockchains. It simply defines the correct steps (order) to execute according
 * to the protocol and binds it to data.
 *
 * As transfers are intended to be preserved to storage and get reloaded, it
 * must follow the rules of encodable data. Due to language "restrictions"
 * this lead to some boilerplate code which is willingly accepted.
 *
 * To ensure backwards compatibility it is important to only add new steps or
 * adapt the logic of a step associated executable. If a step becomes obsolete
 * it can be removed from the list of steps for new transfers, but the execution
 * logic must remain for old transfers. This is important to ensure
 * it will always be possible to execute transfers that got created in the past
 * and get reloaded from user storage.
 * Thereby it is also required that a transfer includes all necessary data that
 * is relevant to execute it. The only no included elements are the environment,
 * i.e. the connections to the network and the user wallet (a transfer can be
 * executed with any wallet account). This includes configuration data of the
 * application used for such connectivity (e.g. network connection information
 * like RPC URLs)) as the configuration can change over time.
 * The data of a transfer includes also all relevant information that are
 * displayed to the user without much further doing and offline (e.g. fetching
 * data from the blockchain must be avoided).
 */
export class Transfer extends MultiStepAction implements Encodable<TransferData> {
  readonly sourceChain: Chain;
  readonly sourceAmount: TokenAmount;
  readonly targetChain: Chain;
  readonly targetAmount: TokenAmount;
  readonly targetAccount: EthereumAddress;
  readonly validityPeriod: UInt256;
  readonly fees: TokenAmount;
  readonly date: Date;
  readonly approveInfiniteAmount: boolean;
  private _allowanceInformation?: AllowanceInformation;
  private _requestInformation?: RequestInformation;
  private _requestFulfillment?: RequestFulfillment;
  private _expired: boolean;
  private _claimCount: number;
  private _withdrawn: boolean;
  private listenerCleanupCallback: CallableFunction | undefined = undefined;

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
    this.approveInfiniteAmount = data.approveInfiniteAmount ?? false;
    this._allowanceInformation = data.allowanceInformation
      ? new AllowanceInformation(data.allowanceInformation)
      : undefined;
    this._requestInformation = data.requestInformation
      ? new RequestInformation(data.requestInformation)
      : undefined;
    this._requestFulfillment = data.requestFulfillment
      ? new RequestFulfillment(data.requestFulfillment)
      : undefined;
    this._expired = data.expired ?? false;
    this._withdrawn = data.withdrawn ?? false;
    this._claimCount = data.claimCount ?? 0;
  }

  /**
   * Convenience function to instance a new transfer more easily.
   * The constructor must follow type restrictions and is meant to
   * (re)instantiate transfer of all versions. This function only creates
   * transfers of the latest version with minimal initial data.
   */
  static new(
    sourceChain: Chain,
    sourceAmount: TokenAmount,
    targetChain: Chain,
    targetAmount: TokenAmount,
    targetAccount: EthereumAddress,
    validityPeriod: UInt256,
    fees: TokenAmount,
    approveInfiniteAmount: boolean,
    requestCreatorAddress: EthereumAddress,
  ): Transfer {
    // We need to create the request information here in order to
    // make sure that all transactions are executed by the same
    // account.
    const requestInformation = new RequestInformation({ requestAccount: requestCreatorAddress });
    return new this({
      sourceChain,
      sourceAmount: sourceAmount.encode(),
      targetChain,
      targetAmount: targetAmount.encode(),
      targetAccount,
      validityPeriod: validityPeriod.encode(),
      fees: fees.encode(),
      date: Date.now(),
      approveInfiniteAmount,
      requestInformation,
    });
  }

  get requestInformation(): RequestInformation | undefined {
    return this._requestInformation;
  }

  get requestFulfillment(): RequestFulfillment | undefined {
    return this._requestFulfillment;
  }

  get allowanceInformation(): AllowanceInformation | undefined {
    return this._allowanceInformation;
  }

  get expired(): boolean {
    return this._expired;
  }

  get withdrawn(): boolean {
    return this._withdrawn;
  }

  get withdrawable(): boolean {
    return this.expired && !this.hasActiveClaims;
  }

  get hasActiveClaims(): boolean {
    return this._claimCount > 0;
  }

  get hasActiveListeners(): boolean {
    return this.listenerCleanupCallback !== undefined;
  }

  get transferTimeSeconds(): number | undefined {
    if (!this._requestInformation?.timestamp || !this._requestFulfillment?.timestamp) {
      return undefined;
    }

    const seconds =
      (this._requestFulfillment.timestamp - this._requestInformation.timestamp) / 1000;

    return Number(seconds.toFixed(1));
  }

  protected getStepMethods(provider: IEthereumProvider): Record<string, CallableFunction> {
    // For backwards compatibility, never remove an entry, only add new ones.
    return {
      ensureTokenAllowance: () => this.ensureTokenAllowance(provider),
      sendRequestTransaction: () => this.sendRequestTransaction(provider),
      waitForRequestEvent: () => this.waitForRequestEvent(),
      waitForFulfillment: () => this.waitForFulfillment(),
    };
  }

  public async execute(provider: IEthereumProvider): Promise<void> {
    const methods = this.getStepMethods(provider);
    return super.executeSteps(methods);
  }

  public async withdraw(provider: IEthereumProvider): Promise<void> {
    if (!this._expired) {
      throw new Error('Can only withdraw transfer funds after request expired!');
    }

    // Theoretically impossible given the above condition.
    if (!this._requestInformation?.identifier) {
      throw new Error('Attempting to withdraw without request identifier!');
    }

    // As long as we have not explicitly set this to `true` we should
    // check it again to avoid unnecessary transactions.
    if (!this._withdrawn) {
      await this.checkAndUpdateState();
    }

    if (this._withdrawn) {
      throw new Error('Funds have been already withdrawn!');
    }

    if (this.hasActiveClaims) {
      throw new Error('Cannot withdraw when there are active claims!');
    }

    if (!provider?.signer?.value) {
      throw new Error('Cannot withdraw without connected wallet!');
    }

    const currentChainIdentifier = await provider.getChainId();

    if (currentChainIdentifier !== this.sourceChain.identifier) {
      let switched = false;
      if (provider.switchChainSafely) {
        switched = await provider.switchChainSafely(this.sourceChain);
      } else {
        throw new Error(
          'For a withdrawal, you need to connect to the chain where the tokens are through your wallet!',
        );
      }
      if (!switched) {
        throw new Error('Cannot withdraw without switching to the chain where the tokens are!');
      }
      return; // For now we must bail out here so the page can reload.
    }

    await withdrawRequest(
      provider,
      this.sourceChain.requestManagerAddress,
      this._requestInformation.identifier,
    );

    this._withdrawn = true;
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
      approveInfiniteAmount: this.approveInfiniteAmount,
      steps: this.steps.map((step) => step.encode()),
      allowanceInformation: this._allowanceInformation?.encode(),
      requestInformation: this._requestInformation?.encode(),
      requestFulfillment: this._requestFulfillment?.encode(),
      expired: this._expired,
      withdrawn: this._withdrawn,
      claimCount: this._claimCount,
    };
  }

  protected async ensureTokenAllowance(provider: IEthereumProvider): Promise<void> {
    if (this._requestInformation === undefined) {
      throw new Error('Request is missing information!');
    }
    if (this._requestInformation.requestAccount !== provider?.signerAddress.value) {
      throw new Error(
        'Trying to execute token allowance with a different account than the creator!',
      );
    }

    let amount: UInt256;
    if (this.approveInfiniteAmount) {
      amount = UInt256.max();
    } else {
      amount = this.sourceAmount.uint256.add(this.fees.uint256);
    }

    if (!this._allowanceInformation) {
      const internalTransactionHash = await ensureTokenAllowance(
        provider,
        this.sourceAmount.token.address,
        this.sourceChain.requestManagerAddress,
        amount,
      );

      this._allowanceInformation = new AllowanceInformation({ internalTransactionHash });
    }

    if (this._allowanceInformation.internalTransactionHash) {
      const transactionHash = await provider.waitForTransaction(
        this._allowanceInformation.internalTransactionHash,
        getConfirmationTimeBlocksForChain(this.sourceChain.identifier),
      );

      this._allowanceInformation.setTransactionHash(transactionHash);
    }

    const successful = await isAllowanceApproved(
      provider,
      this.sourceAmount.token.address,
      this._requestInformation.requestAccount,
      this.sourceChain.requestManagerAddress,
      amount,
    );
    if (!successful) {
      throw new Error('Not enough tokens approved!');
    }
  }

  protected async sendRequestTransaction(provider: IEthereumProvider): Promise<void> {
    if (this._requestInformation === undefined) {
      throw new Error('Request is missing information!');
    }
    if (this._requestInformation.requestAccount !== provider?.signerAddress.value) {
      throw new Error('Trying to execute request with a different account than the creator!');
    }

    // Check if we previously stored a transaction hash in order to skip re-executing a transaction related to this action
    if (this._requestInformation.internalTransactionHash) {
      const transactionHash = await provider.waitForTransaction(
        this._requestInformation.internalTransactionHash,
        getConfirmationTimeBlocksForChain(this.sourceChain.identifier),
      );
      return this._requestInformation.setTransactionHash(transactionHash);
    }

    const approvalNeeded = !(await isAllowanceApproved(
      provider,
      this.sourceAmount.token.address,
      this._requestInformation.requestAccount,
      this.sourceChain.requestManagerAddress,
      this.sourceAmount.uint256.add(this.fees.uint256),
    ));
    if (approvalNeeded) {
      throw new Error('Not enough tokens approved!');
    }

    const blockNumberOnTargetChain = await getCurrentBlockNumber(this.targetChain.internalRpcUrl);

    const internalTransactionHash = await sendRequestTransaction(
      provider,
      this.sourceAmount.uint256,
      this.targetChain.identifier,
      this.sourceChain.requestManagerAddress,
      this.sourceAmount.token.address,
      this.targetAmount.token.address,
      this.targetAccount,
      this.validityPeriod,
    );

    this._requestInformation.setBlockNumberOnTargetChain(blockNumberOnTargetChain);
    this._requestInformation.setInternalTransactionHash(internalTransactionHash);

    const transactionHash = await provider.waitForTransaction(
      internalTransactionHash,
      getConfirmationTimeBlocksForChain(this.sourceChain.identifier),
    );

    this._requestInformation.setTransactionHash(transactionHash);
  }

  protected async waitForRequestEvent(): Promise<void> {
    if (!this._requestInformation?.transactionHash) {
      throw new Error('Attempt to get request event before sending transaction!');
    }

    const requestId = await getRequestInformation(
      this.sourceChain.internalRpcUrl,
      this.sourceChain.requestManagerAddress,
      this._requestInformation.transactionHash,
    );

    this._requestInformation.setIdentifier(requestId);
    this._requestInformation.setTimestamp(Date.now());
  }

  protected async waitForFulfillment(): Promise<void> {
    if (!this._requestInformation?.identifier) {
      throw new Error('Attempting to wait for fulfillment without request identifier!');
    }

    const { promise: fulfillmentPromise, cancel: cancelFulfillmentChecks } = waitForFulfillment(
      this.targetChain.internalRpcUrl,
      this.targetChain.fillManagerAddress,
      this._requestInformation.identifier,
      this._requestInformation.blockNumberOnTargetChain,
    );

    const { promise: expirationPromise, cancel: cancelExpirationCheck } = failWhenRequestExpires(
      this.sourceChain.internalRpcUrl,
      this.sourceChain.requestManagerAddress,
      this._requestInformation.identifier,
    );

    fulfillmentPromise.then(
      () => (this._requestFulfillment = new RequestFulfillment({ timestamp: Date.now() })),
    );

    try {
      await Promise.race([fulfillmentPromise, expirationPromise]);
    } catch (exception: unknown) {
      if (exception instanceof RequestExpiredError) {
        this._expired = true;
        await this.checkAndUpdateState();
      }

      throw exception;
    } finally {
      cancelFulfillmentChecks();
      cancelExpirationCheck();
    }
  }

  public async checkAndUpdateState(): Promise<void> {
    if (!this._requestInformation?.identifier) {
      throw new Error('Can not check state without request identfier!');
    }

    const { withdrawn, activeClaims } = await getRequestData(
      this.sourceChain.internalRpcUrl,
      this.sourceChain.requestManagerAddress,
      this._requestInformation.identifier,
    );

    this._withdrawn = withdrawn;
    this._claimCount = activeClaims;
  }

  public startClaimEventListeners(): void {
    if (!this._requestInformation?.identifier) {
      throw new Error('Can not listen to claim events without an identifier!');
    }

    if (this.listenerCleanupCallback) {
      throw new Error('There are already active listeners.');
    }

    const { cancel } = listenOnClaimCountChange({
      rpcUrl: this.sourceChain.rpcUrl,
      requestManagerAddress: this.sourceChain.requestManagerAddress,
      requestIdentifier: this._requestInformation?.identifier,
      onReduce: () => this.checkAndUpdateState(),
      onIncrease: () => this.checkAndUpdateState(),
    });

    this.listenerCleanupCallback = cancel;
  }

  public stopEventListeners(): void {
    if (this.listenerCleanupCallback) {
      this.listenerCleanupCallback();
      this.listenerCleanupCallback = undefined;
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
  requestCreatorAddress?: boolean;
  approveInfiniteAmount?: boolean;
  steps?: Array<StepData>;
  allowanceInformation?: AllowanceInformationData;
  requestInformation?: RequestInformationData;
  requestFulfillment?: RequestFulfillmentData;
  expired?: boolean;
  withdrawn?: boolean;
  claimCount?: number;
};
