import { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { DeepReadonly } from 'vue';

import StandardToken from '@/assets/StandardToken.json';

export async function ensureTokenAllowance(
  signer: DeepReadonly<JsonRpcSigner>,
  tokenAddress: string,
  allowedSpender: string,
  amount: BigNumber,
): Promise<void> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi, signer);
  const signerAddress = await signer.getAddress();
  const allowance: BigNumber = await tokenContract.allowance(signerAddress, allowedSpender);
  if (allowance.lt(amount)) {
    const transaction = await tokenContract.approve(allowedSpender, amount);
    await transaction.wait();
  }
}

export async function mint(
  signer: DeepReadonly<JsonRpcSigner>,
  tokenAddress: string,
  amount: BigNumber,
): Promise<void> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi, signer);
  const signerAddress = await signer.getAddress();
  const transaction = await tokenContract.mint(signerAddress, amount);
  await transaction.wait();
}
