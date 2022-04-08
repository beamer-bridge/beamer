import { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { DeepReadonly } from 'vue';

import StandardToken from '@/assets/StandardToken.json';
import { EthereumProvider } from '@/services/web3-provider';

export async function ensureTokenAllowance(
  signer: DeepReadonly<JsonRpcSigner>,
  tokenAddress: string,
  allowedSpender: string,
  amount: BigNumber,
): Promise<void> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi, signer);
  const signerAddress = await signer.getAddress();
  const signerTokenBalance = await tokenContract.balanceOf(signerAddress);
  const allowance: BigNumber = await tokenContract.allowance(signerAddress, allowedSpender);
  if (allowance.lt(amount)) {
    const transaction = await tokenContract.approve(allowedSpender, signerTokenBalance);
    await transaction.wait();
  }
}

export async function getTokenDecimals(
  ethereumProvider: Readonly<EthereumProvider>,
  tokenAddress: string,
): Promise<BigNumber> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi);
  const connectedContract = ethereumProvider.connectContract(tokenContract);
  return await connectedContract.decimals();
}

export async function getTokenBalance(
  ethereumProvider: Readonly<EthereumProvider>,
  tokenAddress: string,
  accountAddress: string,
): Promise<BigNumber> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi);
  const connectedContract = ethereumProvider.connectContract(tokenContract);
  return await connectedContract.balanceOf(accountAddress);
}
