import type {
  JsonRpcProvider,
  JsonRpcSigner,
  TransactionResponse,
} from '@ethersproject/providers';
import type { BigNumberish } from 'ethers';
import { BigNumber, Contract } from 'ethers';

import RequestManager from '@/assets/RequestManager.json';
import type { EthereumProvider } from '@/services/web3-provider';
import type { EthereumAddress } from '@/types/data';
import { EthereumAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export async function getRequestFee(
  provider: EthereumProvider,
  requestManagerAddress: string,
): Promise<EthereumAmount> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi);
  const connectedContract = provider.connectContract(requestManagerContract);
  const fetchedAmount: BigNumberish = await connectedContract.totalFee();
  return new EthereumAmount(fetchedAmount.toString());
}

export async function sendRequestTransaction(
  signer: JsonRpcSigner,
  amount: UInt256,
  targetChainIdentifier: number,
  requestManagerAddress: EthereumAddress,
  sourceTokenAddress: EthereumAddress,
  targetTokenAddress: EthereumAddress,
  targetAccount: EthereumAddress,
  validityPeriod: UInt256,
  fees: UInt256,
): Promise<string> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, signer);

  const requestParameter = [
    targetChainIdentifier,
    sourceTokenAddress,
    targetTokenAddress,
    targetAccount,
    BigNumber.from(amount.asString),
    BigNumber.from(validityPeriod.asString),
  ];

  try {
    const estimatedGasLimit = await requestManagerContract.estimateGas.createRequest(
      ...requestParameter,
      { value: BigNumber.from(fees.asString) },
    );

    const transaction: TransactionResponse = await requestManagerContract.createRequest(
      ...requestParameter,
      { value: BigNumber.from(fees.asString), gasLimit: estimatedGasLimit },
    );

    return transaction.hash;
  } catch (error: unknown) {
    const parseErrorMessage = getTransactionErrorMessage(error);
    console.log(parseErrorMessage);
    throw new Error(parseErrorMessage);
  }
}

export async function getRequestIdentifier(
  provider: JsonRpcProvider,
  requestManagerAddress: EthereumAddress,
  transactionHash: string,
): Promise<UInt256> {
  const requestManagerContract = new Contract(requestManagerAddress, RequestManager.abi, provider);
  const transaction = await provider.getTransaction(transactionHash);
  const receipt = await transaction.wait();
  const event = requestManagerContract.interface.parseLog(receipt.logs[0]);

  if (event) {
    return new UInt256(event.args.requestId);
  } else {
    throw new Error("Request Failed. Couldn't retrieve Request ID");
  }
}

function getTransactionErrorMessage(error: unknown): string {
  const maybeErrorCode = (error as { code?: number }).code;

  // TODO move all custom errors to error handling library
  if (error instanceof Error) {
    return error.message;
  } else if (maybeErrorCode && maybeErrorCode === 4001) {
    return 'Transaction got rejected!';
  } else if (maybeErrorCode && maybeErrorCode === -32603) {
    return 'Insufficient balance!';
  } else {
    return 'Unknown failure!';
  }
}
