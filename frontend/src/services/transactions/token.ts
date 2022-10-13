import type { JsonRpcSigner, Listener } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';

import StandardToken from '@/assets/StandardToken.json';
import type { IEthereumProvider } from '@/services/web3-provider';
import type { EthereumAddress, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export async function ensureTokenAllowance(
  signer: JsonRpcSigner,
  tokenAddress: string,
  allowedSpender: string,
  minimumRequiredAmount: UInt256,
): Promise<void> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi, signer);
  const signerAddress = await signer.getAddress();
  const allowance: BigNumber = await tokenContract.allowance(signerAddress, allowedSpender);
  const approvalAmount = BigNumber.from(minimumRequiredAmount.asString);
  if (allowance.lt(approvalAmount)) {
    const transaction = await tokenContract.approve(allowedSpender, approvalAmount);
    await transaction.wait();
  }
}

export async function getTokenDecimals(
  provider: IEthereumProvider,
  tokenAddress: string,
): Promise<BigNumber> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi);
  const connectedContract = provider.connectContract(tokenContract);
  return await connectedContract.decimals();
}

export async function getTokenBalance(
  provider: IEthereumProvider,
  token: Token,
  accountAddress: string,
): Promise<TokenAmount> {
  const tokenContract = new Contract(token.address, StandardToken.abi);
  const connectedContract = provider.connectContract(tokenContract);
  const balance: BigNumber = await connectedContract.balanceOf(accountAddress);
  return TokenAmount.new(new UInt256(balance.toString()), token);
}

export function listenOnTokenBalanceChange(options: {
  provider: IEthereumProvider;
  token: Token;
  addressToListen: EthereumAddress;
  onReduce: Listener;
  onIncrease: Listener;
}): Contract {
  const tokenContract = options.provider.connectContract(
    new Contract(options.token.address, StandardToken.abi),
  );

  const sendFilter = tokenContract.filters.Transfer(options.addressToListen, undefined);
  const receiveFilter = tokenContract.filters.Transfer(undefined, options.addressToListen);

  tokenContract.on(sendFilter, options.onReduce);
  tokenContract.on(receiveFilter, options.onIncrease);

  return tokenContract;
}
