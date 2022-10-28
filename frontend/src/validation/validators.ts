import { isAddress } from 'ethers/lib/utils';

import type { Chain, EthereumAddress } from '@/types/data';
import type { TokenAmount } from '@/types/token-amount';
import { isAddressBlacklisted } from '@/utils/addressBlacklist';

type ValidatorFunction<T> = (value: T) => boolean;

export const isValidEthAddress: ValidatorFunction<string> = function (value: string): boolean {
  return isAddress(value);
};

export const isUnsignedNumeric: ValidatorFunction<string> = function (value: string): boolean {
  return /^\d*(\.\d+)?$/.test(value);
};

export const makeMatchingDecimalsValidator =
  (decimals: number): ValidatorFunction<string> =>
  (value: string): boolean => {
    return !value.includes('.') || value.split('.')[1].length <= decimals;
  };

export const makeNotSameAsChainValidator =
  (chain: Chain): ValidatorFunction<Chain> =>
  (value: Chain): boolean => {
    return chain.identifier !== value.identifier;
  };

export const makeMinTokenAmountValidator =
  (min: TokenAmount): ValidatorFunction<TokenAmount> =>
  (value: TokenAmount): boolean => {
    return min.uint256.lte(value.uint256);
  };

export const makeMaxTokenAmountValidator =
  (max: TokenAmount): ValidatorFunction<TokenAmount> =>
  (value: TokenAmount): boolean => {
    return max.uint256.gte(value.uint256);
  };

export const makeIsNotBlacklistedEthAddressValidator =
  (blacklist?: EthereumAddress[]): ValidatorFunction<EthereumAddress> =>
  (value: EthereumAddress): boolean => {
    return !isAddressBlacklisted(value, blacklist);
  };

export default {
  isValidEthAddress,
  makeMatchingDecimalsValidator,
  makeNotSameAsChainValidator,
  makeMinTokenAmountValidator,
  makeMaxTokenAmountValidator,
  makeIsNotBlacklistedEthAddressValidator,
};
