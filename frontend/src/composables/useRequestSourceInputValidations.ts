import type { ValidationArgs } from '@vuelidate/core';
import { useVuelidate } from '@vuelidate/core';
import { helpers, minValue, numeric, required, sameAs } from '@vuelidate/validators';
import type { BigNumber } from 'ethers';
import type { ComputedRef, Ref, WritableComputedRef } from 'vue';
import { computed } from 'vue';

import type { Chain, Token } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import {
  makeMatchingDecimalsValidator,
  makeMaxTokenAmountValidator,
  makeMinTokenAmountValidator,
} from '@/validation/validators';

type ValidationState = {
  selectedSourceChain: WritableComputedRef<SelectorOption<Chain> | null>;
  selectedToken: WritableComputedRef<SelectorOption<Token> | null>;
  selectedAmount: Ref<string>;
  selectedTokenAmount: ComputedRef<TokenAmount | undefined>;
  totalRequestTokenAmount: ComputedRef<TokenAmount | undefined>;
  requestFeeLoading: Ref<boolean>;
};
type ValidationRules = ValidationArgs<{
  selectedSourceChain: WritableComputedRef<SelectorOption<Chain> | null>;
  selectedToken: WritableComputedRef<SelectorOption<Token> | null>;
  selectedAmount?: Ref<string>;
  selectedTokenAmount?: ComputedRef<TokenAmount | undefined>;
  totalRequestTokenAmount?: ComputedRef<TokenAmount | undefined>;
  requestFeeLoading?: Ref<boolean>;
}>;

export const useRequestSourceInputValidations = (
  options: ValidationState & {
    balance: Ref<BigNumber>;
  },
) => {
  const computedRules: ComputedRef<ValidationRules> = computed(() => {
    const amountValidationGroup: string[] = [];
    const rules = {
      selectedSourceChain: {
        required,
      },
      selectedToken: {
        required,
      },
      $validationGroups: {
        amount: amountValidationGroup,
      },
    };

    if (options.selectedToken.value) {
      const selectedTokenValue = options.selectedToken.value.value;
      const selectedTokenDecimals = selectedTokenValue.decimals;
      const selectedAmountRules = {
        required: helpers.withMessage('Amount is required', required),
        isMatchingDecimals: helpers.withMessage(
          `Max. number of decimals: ${selectedTokenDecimals}`,
          makeMatchingDecimalsValidator(selectedTokenDecimals),
        ),
        numeric: helpers.withMessage('Must be a positive number', numeric),
        minValue: helpers.withMessage('Must be a positive number', minValue(0)),
      };
      Object.assign(rules, { selectedAmount: selectedAmountRules });

      if (options.selectedTokenAmount.value) {
        const min = TokenAmount.parse(
          ['0.', '0'.repeat(selectedTokenDecimals - 1), '1'].join(''),
          selectedTokenValue,
        );
        const selectedTokenAmountRules = {
          minValue: helpers.withMessage(
            `Must be a positive number`,
            makeMinTokenAmountValidator(min),
          ),
        };
        Object.assign(rules, { selectedTokenAmount: selectedTokenAmountRules });

        const totalRequestTokenAmountRules = {
          maxValue: helpers.withMessage('Insufficient funds', (value: TokenAmount) => {
            if (!value || !options.selectedToken.value) {
              return true;
            }
            // Due to reactivity issues `max` has to be initialized here
            const max = new TokenAmount({
              amount: options.balance.value.toString(),
              token: options.selectedToken.value.value,
            });
            return makeMaxTokenAmountValidator(max)(value);
          }),
        };
        Object.assign(rules, { totalRequestTokenAmount: totalRequestTokenAmountRules });

        amountValidationGroup.push('selectedTokenAmount', 'totalRequestTokenAmount');
      }

      const requestFeeLoadingRules = {
        sameAs: sameAs(false),
      };
      Object.assign(rules, { requestFeeLoading: requestFeeLoadingRules });

      amountValidationGroup.push('selectedAmount');
    }
    return rules;
  });

  const state: ValidationState = {
    selectedSourceChain: options.selectedSourceChain,
    selectedToken: options.selectedToken,
    selectedAmount: options.selectedAmount,
    selectedTokenAmount: options.selectedTokenAmount,
    totalRequestTokenAmount: options.totalRequestTokenAmount,
    requestFeeLoading: options.requestFeeLoading,
  };

  return useVuelidate<ValidationState, ValidationRules>(computedRules, state, {
    $autoDirty: true,
  });
};
