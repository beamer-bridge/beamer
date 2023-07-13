import { getJsonRpcProvider, getReadOnlyContract } from '@/services/transactions/utils';
import type { Chain, Token } from '@/types/data';
import type { FeeSub } from '@/types/ethers-contracts';
import { FeeSub__factory } from '@/types/ethers-contracts';
import { MintableToken__factory } from '@/types/ethers-contracts/factories/goerli';
import type { MintableToken } from '@/types/ethers-contracts/goerli';
import type { TokenAmount } from '@/types/token-amount';

import { getRequestFee } from './request-manager';

export async function contract_amountCanBeSubsidized(
  sourceChain: Chain,
  targetChain: Chain,
  token: Token,
  tokenAmount: TokenAmount,
): Promise<boolean> {
  if (!sourceChain.feeSubAddress) {
    return false;
  }
  const provider = getJsonRpcProvider(sourceChain.internalRpcUrl);

  const feeSubContract = getReadOnlyContract<FeeSub>(
    sourceChain.feeSubAddress,
    FeeSub__factory.createInterface(),
    provider,
  );

  const canBeSubsidized = await feeSubContract.tokenAmountCanBeSubsidized(
    targetChain.identifier,
    token.address,
    tokenAmount.uint256.asBigNumber,
  );

  return canBeSubsidized;
}

export async function amountCanBeSubsidized(
  sourceChain: Chain,
  targetChain: Chain,
  token: Token,
  tokenAmount: TokenAmount,
): Promise<boolean> {
  if (!sourceChain.feeSubAddress) {
    return false;
  }
  const provider = getJsonRpcProvider(sourceChain.internalRpcUrl);

  const feeSubContract = getReadOnlyContract<FeeSub>(
    sourceChain.feeSubAddress,
    FeeSub__factory.createInterface(),
    provider,
  );
  const minAmountThreshold = await feeSubContract.minimumAmounts(token.address);

  if (minAmountThreshold.isZero() || minAmountThreshold.gt(tokenAmount.uint256.asBigNumber)) {
    return false;
  }

  const tokenContract = getReadOnlyContract<MintableToken>(
    token.address,
    MintableToken__factory.createInterface(),
    provider,
  );

  const contractTokenBalance = await tokenContract.balanceOf(sourceChain.feeSubAddress);
  const totalFee = await getRequestFee(
    sourceChain.rpcUrl,
    sourceChain.requestManagerAddress,
    tokenAmount,
    targetChain.identifier,
  );

  if (contractTokenBalance.lt(totalFee.asBigNumber)) {
    return false;
  }

  return true;
}
