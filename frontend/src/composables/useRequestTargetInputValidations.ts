import type { ValidationArgs } from '@vuelidate/core';
import { useVuelidate } from '@vuelidate/core';
import { helpers, required } from '@vuelidate/validators';
import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';

import type { Chain } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import {
  isValidEthAddress,
  makeIsNotBlacklistedEthAddressValidator,
  makeNotSameAsChainValidator,
} from '@/validation/validators';

type ValidationState = {
  selectedTargetChain: Ref<SelectorOption<Chain> | null>;
  selectedTargetAddress: Ref<string>;
};
type ValidationRules = ValidationArgs<{
  selectedTargetChain: Ref<SelectorOption<Chain> | null>;
  selectedTargetAddress: Ref<string>;
}>;

export const useRequestTargetInputValidations = (
  options: ValidationState & {
    sourceChain: Ref<SelectorOption<Chain> | null>;
  },
) => {
  const computedRules: ComputedRef<ValidationRules> = computed(() => {
    const rules = {
      selectedTargetAddress: {
        required: helpers.withMessage('Target address is required', required),
        isValidEthAddress: helpers.withMessage('Invalid ETH address', isValidEthAddress),
        makeIsNotBlacklistedEthAddressValidator: helpers.withMessage(
          'Blacklisted ETH address',
          makeIsNotBlacklistedEthAddressValidator(),
        ),
      },
      selectedTargetChain: {
        required,
      },
    };

    if (
      options.selectedTargetChain.value &&
      options.sourceChain?.value &&
      process.env.NODE_ENV !== 'development'
    ) {
      const sourceChainTemporary = options.sourceChain.value.value;
      Object.assign(rules.selectedTargetChain, {
        notSameAsSourceChain: (chain: SelectorOption<Chain>) =>
          makeNotSameAsChainValidator(sourceChainTemporary)(chain?.value),
      });
    }

    return rules;
  });

  const state = {
    selectedTargetChain: options.selectedTargetChain,
    selectedTargetAddress: options.selectedTargetAddress,
  };

  return useVuelidate<ValidationState, ValidationRules>(computedRules, state, {
    $autoDirty: true,
  });
};
