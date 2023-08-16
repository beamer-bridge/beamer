import MintableTokenDeployment from '@beamer-bridge/deployments/dist/abis/goerli/MintableToken.json';
import type { Listener } from '@ethersproject/providers';
import type { Contract } from 'ethers';

import {
  getReadOnlyContract,
  getReadWriteContract,
  getSafeEventHandler,
} from '@/services/transactions/utils';
import type { IEthereumProvider, IEthereumWallet } from '@/services/web3-provider';
import type { EthereumAddress, Token, TransactionHash } from '@/types/data';
import type { MintableToken } from '@/types/ethers-contracts/goerli';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export async function ensureTokenAllowance(
  provider: IEthereumWallet,
  tokenAddress: string,
  allowedSpender: string,
  minimumRequiredAmount: UInt256,
): Promise<TransactionHash | undefined> {
  const signer = provider.signer.value;
  if (signer === undefined) {
    throw new Error('Missing signer!');
  }
  const tokenContract = getReadWriteContract<MintableToken>(
    tokenAddress,
    MintableTokenDeployment.abi,
    signer,
  );
  const signerAddress = await signer.getAddress();

  const approvalNeeded = !(await isAllowanceApproved(
    provider,
    tokenAddress,
    signerAddress,
    allowedSpender,
    minimumRequiredAmount,
  ));
  if (approvalNeeded) {
    const transaction = await tokenContract.approve(
      allowedSpender,
      minimumRequiredAmount.asBigNumber,
    );

    return transaction.hash;
  }
}

export async function isAllowanceApproved(
  provider: IEthereumProvider,
  tokenAddress: string,
  ownerAddress: string,
  allowedSpender: string,
  minimumRequiredAmount: UInt256,
): Promise<boolean> {
  const tokenContract = getReadOnlyContract<MintableToken>(
    tokenAddress,
    MintableTokenDeployment.abi,
    provider.getProvider(),
  );
  const allowance = new UInt256(
    (await tokenContract.allowance(ownerAddress, allowedSpender)).toString(),
  );

  return allowance.gte(minimumRequiredAmount);
}

export async function getTokenBalance(
  provider: IEthereumProvider,
  token: Token,
  accountAddress: string,
): Promise<TokenAmount> {
  const tokenContract = getReadOnlyContract<MintableToken>(
    token.address,
    MintableTokenDeployment.abi,
    provider.getProvider(),
  );
  const balance = new UInt256((await tokenContract.balanceOf(accountAddress)).toString());
  return TokenAmount.new(balance, token);
}

export async function getTokenAllowance(
  provider: IEthereumProvider,
  token: Token,
  ownerAddress: EthereumAddress,
  spenderAddress: EthereumAddress,
): Promise<TokenAmount> {
  const tokenContract = getReadOnlyContract<MintableToken>(
    token.address,
    MintableTokenDeployment.abi,
    provider.getProvider(),
  );
  const allowance = new UInt256(
    (await tokenContract.allowance(ownerAddress, spenderAddress)).toString(),
  );
  return TokenAmount.new(allowance, token);
}

export function listenOnTokenBalanceChange(options: {
  provider: IEthereumProvider;
  token: Token;
  addressToListen: EthereumAddress;
  onReduce: Listener;
  onIncrease: Listener;
}): Contract {
  const tokenContract = getReadOnlyContract<MintableToken>(
    options.token.address,
    MintableTokenDeployment.abi,
    options.provider.getProvider(),
  );

  const sendFilter = tokenContract.filters.Transfer(options.addressToListen, undefined);
  const receiveFilter = tokenContract.filters.Transfer(undefined, options.addressToListen);

  tokenContract.on(sendFilter, getSafeEventHandler(options.onReduce, tokenContract.provider));
  tokenContract.on(receiveFilter, getSafeEventHandler(options.onIncrease, tokenContract.provider));

  return tokenContract;
}
