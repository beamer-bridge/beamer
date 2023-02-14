import type { JsonRpcSigner, Listener } from '@ethersproject/providers';
import type { Contract } from 'ethers';

import StandardTokenDeployment from '@/assets/StandardToken.json';
import { getReadOnlyContract, getReadWriteContract } from '@/services/transactions/utils';
import type { IEthereumProvider } from '@/services/web3-provider';
import type { EthereumAddress, Token } from '@/types/data';
import type { StandardToken } from '@/types/ethers-contracts';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export async function ensureTokenAllowance(
  signer: JsonRpcSigner,
  tokenAddress: string,
  allowedSpender: string,
  minimumRequiredAmount: UInt256,
): Promise<void> {
  const tokenContract = getReadWriteContract<StandardToken>(
    tokenAddress,
    StandardTokenDeployment.abi,
    signer,
  );
  const signerAddress = await signer.getAddress();
  const allowance = new UInt256(
    (await tokenContract.allowance(signerAddress, allowedSpender)).toString(),
  );
  if (allowance.lt(minimumRequiredAmount)) {
    const transaction = await tokenContract.approve(
      allowedSpender,
      minimumRequiredAmount.asBigNumber,
    );
    await transaction.wait();
  }
}

export async function getTokenBalance(
  provider: IEthereumProvider,
  token: Token,
  accountAddress: string,
): Promise<TokenAmount> {
  const tokenContract = getReadOnlyContract<StandardToken>(
    token.address,
    StandardTokenDeployment.abi,
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
  const tokenContract = getReadOnlyContract<StandardToken>(
    token.address,
    StandardTokenDeployment.abi,
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
  const tokenContract = getReadOnlyContract<StandardToken>(
    options.token.address,
    StandardTokenDeployment.abi,
    options.provider.getProvider(),
  );

  const sendFilter = tokenContract.filters.Transfer(options.addressToListen, undefined);
  const receiveFilter = tokenContract.filters.Transfer(undefined, options.addressToListen);

  tokenContract.on(sendFilter, options.onReduce);
  tokenContract.on(receiveFilter, options.onIncrease);

  return tokenContract;
}
