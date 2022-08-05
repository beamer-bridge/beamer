import { ethers } from 'ethers';

import type { Chain } from '@/types/data';
import type { TokenAmount } from '@/types/token-amount';

/**
 * Checks if the provided `value` is a valid ethereum address
 *
 * @method isValidEthAddress
 * @param {String} value
 * @return {Boolean}
 */
export const isValidEthAddress = function (value: string) {
  return ethers.utils.isAddress(value);
};

/**
 * Returns a configured validator function which
 * checks if the provided `value` contains less then or equal to
 * `decimals` number of decimals.
 *
 * @method isMatchingDecimals
 * @param {Number} decimals Number of decimals to check against
 * @return {Function}
 */
export const isMatchingDecimals = (decimals: number) => (value: string) => {
  return !value.includes('.') || value.split('.')[1].length <= decimals;
};

/**
 * Returns a configured validator function which
 * compares two chains for inequality
 *
 * @method notSameAsChain
 * @param {Chain} chain Chain to compare with
 * @return {Function}
 */
export const notSameAsChain = (chain: Chain) => (value: Chain) => {
  return chain.identifier !== value.identifier;
};

/**
 * Returns a configured validator function which
 * checks if the provided `value` is
 * higher than or equal to `min` TokenAmount
 *
 * @method minValueUInt256
 * @param {TokenAmount} min Minimum TokenAmount acting as a lower limit
 * @return {Function}
 */
export const minTokenAmount = (min: TokenAmount) => (value: TokenAmount) => {
  return min.uint256.lte(value.uint256);
};

/**
 * Returns a configured validator function which
 * checks if the provided `value` is
 * lower than or equal to `max` TokenAmount
 *
 * @method maxValueUInt256
 * @param {TokenAmount} max Maximum TokenAmount acting as an upper limit
 * @return {Function}
 */
export const maxTokenAmount = (max: TokenAmount) => (value: TokenAmount) => {
  return max.uint256.gte(value.uint256);
};

export default {
  isValidEthAddress,
  isMatchingDecimals,
  minTokenAmount,
  maxTokenAmount,
};
