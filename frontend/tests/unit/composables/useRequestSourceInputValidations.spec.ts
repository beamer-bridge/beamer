import type { ComputedRef, Ref } from 'vue';
import { computed, nextTick, ref } from 'vue';

import { useRequestSourceInputValidations } from '@/composables/useRequestSourceInputValidations';
import type { Chain, Token } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import { generateChainSelectorOption, generateTokenSelectorOption } from '~/utils/data_generators';

function createConfig(options?: {
  selectedSourceChain?: Ref<SelectorOption<Chain> | null>;
  selectedToken?: Ref<SelectorOption<Token> | null>;
  selectedAmount?: Ref<string>;
  selectedTokenAmount?: ComputedRef<TokenAmount | undefined>;
  totalRequestTokenAmount?: ComputedRef<TokenAmount | undefined>;
  requestFeeLoading?: Ref<boolean>;
  balance?: Ref<TokenAmount | undefined>;
  transferLimitTokenAmount?: Ref<TokenAmount | undefined>;
}) {
  return {
    selectedSourceChain: options?.selectedSourceChain ?? ref(null),
    selectedToken: options?.selectedToken ?? ref(null),
    selectedAmount: options?.selectedAmount ?? ref(''),
    selectedTokenAmount: options?.selectedTokenAmount ?? computed(() => undefined),
    totalRequestTokenAmount: options?.totalRequestTokenAmount ?? computed(() => undefined),
    requestFeeLoading: options?.requestFeeLoading ?? ref(false),
    balance: options?.balance ?? ref(undefined),
    transferLimitTokenAmount: options?.transferLimitTokenAmount ?? ref(undefined),
  };
}

describe('useRequestSourceInputValidations', () => {
  it('returns a computed property that holds the validity state of the request source input form', () => {
    const v$ = useRequestSourceInputValidations(createConfig());
    expect(v$.value.$invalid).toBeDefined();
  });

  describe('selectedSourceChain', () => {
    it('is valid when a selection has been made', () => {
      const selectedSourceChain = ref(generateChainSelectorOption());
      const v$ = useRequestSourceInputValidations(createConfig({ selectedSourceChain }));
      expect(v$.value.selectedSourceChain.$invalid).toBe(false);
    });
    it('is invalid when there is no selection', () => {
      const selectedSourceChain = ref<SelectorOption<Chain> | null>(null);
      const v$ = useRequestSourceInputValidations(createConfig({ selectedSourceChain }));
      expect(v$.value.selectedSourceChain.$invalid).toBe(true);
    });
  });

  describe('selectedToken', () => {
    it('is valid when a selection has been made', () => {
      const selectedToken = ref(generateTokenSelectorOption());
      const v$ = useRequestSourceInputValidations(createConfig({ selectedToken }));
      expect(v$.value.selectedToken.$invalid).toBe(false);
    });
    it('is invalid when there is no selection', () => {
      const selectedToken = ref<SelectorOption<Token> | null>(null);
      const v$ = useRequestSourceInputValidations(createConfig({ selectedToken }));
      expect(v$.value.selectedToken.$invalid).toBe(true);
    });
  });

  describe('selectedAmount', () => {
    it('is valid when it holds a positive numerical value', () => {
      const selectedAmount = ref('123');
      const v$ = useRequestSourceInputValidations(createConfig({ selectedAmount }));
      expect(v$.value.selectedAmount.$invalid).toBe(false);
    });
    it('is invalid when it holds a negative numerical value', () => {
      const selectedAmount = ref('-123');
      const v$ = useRequestSourceInputValidations(createConfig({ selectedAmount }));
      expect(v$.value.selectedAmount.$invalid).toBe(true);
    });
    it('is invalid when it holds a non numerical value', () => {
      const selectedAmount = ref('12.asd');
      const v$ = useRequestSourceInputValidations(createConfig({ selectedAmount }));
      expect(v$.value.selectedAmount.$invalid).toBe(true);
    });
    it('is invalid when it exceeds total number of token decimals allowed', async () => {
      const selectedAmount = ref('1.0000001');
      const selectedToken = ref<SelectorOption<Token> | null>(null);
      const v$ = useRequestSourceInputValidations(createConfig({ selectedAmount, selectedToken }));
      expect(v$.value.selectedAmount.$invalid).toBe(false);
      selectedToken.value = generateTokenSelectorOption({ decimals: 6 });
      await nextTick();
      expect(v$.value.selectedAmount.$invalid).toBe(true);
    });
  });

  describe('selectedTokenAmount', () => {
    it('is valid when it holds a positive token amount value', () => {
      const token = generateTokenSelectorOption({ decimals: 6 });
      const selectedToken = ref(token);
      const selectedAmount = ref('0.1');
      const selectedTokenAmount = computed(() =>
        TokenAmount.parse(selectedAmount.value, selectedToken.value?.value),
      );

      const v$ = useRequestSourceInputValidations(
        createConfig({
          selectedToken,
          selectedAmount,
          selectedTokenAmount,
        }),
      );

      expect(v$.value.selectedTokenAmount?.$invalid).toBe(false);
    });
    it('is invalid when it holds a non positive token amount value', () => {
      const token = generateTokenSelectorOption({ decimals: 6 });
      const selectedToken = ref(token);
      const selectedAmount = ref('0');
      const selectedTokenAmount = computed(() =>
        TokenAmount.parse(selectedAmount.value, selectedToken.value.value),
      );

      const v$ = useRequestSourceInputValidations(
        createConfig({
          selectedToken,
          selectedAmount,
          selectedTokenAmount,
        }),
      );

      expect(v$.value.selectedTokenAmount?.$invalid).toBe(true);
    });

    describe('when a transfer limit is defined', () => {
      it('is valid when it holds a positive token amount that is lower than the provided transfer limit', () => {
        const token = generateTokenSelectorOption({ decimals: 6 });
        const selectedToken = ref(token);
        const selectedAmount = ref('0.1');
        const selectedTokenAmount = computed(() =>
          TokenAmount.parse(selectedAmount.value, selectedToken.value?.value),
        );
        const transferLimitTokenAmount: Ref<TokenAmount | undefined> = ref(undefined);
        transferLimitTokenAmount.value = TokenAmount.parse('0.2', selectedToken.value.value);

        const v$ = useRequestSourceInputValidations(
          createConfig({
            selectedToken,
            selectedAmount,
            selectedTokenAmount,
            transferLimitTokenAmount,
          }),
        );

        expect(v$.value.selectedTokenAmount?.$invalid).toBe(false);
      });
      it('is invalid when it holds a positive token amount that is higher than the provided transfer limit', () => {
        const token = generateTokenSelectorOption({ decimals: 6 });
        const selectedToken = ref(token);
        const selectedAmount = ref('0.3');
        const selectedTokenAmount = computed(() =>
          TokenAmount.parse(selectedAmount.value, selectedToken.value?.value),
        );
        const transferLimitTokenAmount: Ref<TokenAmount | undefined> = ref(undefined);
        transferLimitTokenAmount.value = TokenAmount.parse('0.2', selectedToken.value.value);

        const v$ = useRequestSourceInputValidations(
          createConfig({
            selectedToken,
            selectedAmount,
            selectedTokenAmount,
            transferLimitTokenAmount,
          }),
        );

        expect(v$.value.selectedTokenAmount?.$invalid).toBe(true);
      });
    });
  });

  describe('totalRequestTokenAmount', () => {
    it('is valid when request token amount does not exceed user wallet balance', () => {
      const token = generateTokenSelectorOption({ decimals: 6 });
      const selectedToken = ref(token);
      const balance: Ref<TokenAmount | undefined> = ref(undefined);
      balance.value = TokenAmount.parse('0.1', token.value);

      const selectedAmount = ref('0.09');
      const selectedTokenAmount = computed(() =>
        TokenAmount.parse(selectedAmount.value, selectedToken.value.value),
      );
      const totalRequestTokenAmount = selectedTokenAmount;

      const v$ = useRequestSourceInputValidations(
        createConfig({
          selectedToken,
          selectedAmount,
          selectedTokenAmount,
          totalRequestTokenAmount,
          balance,
        }),
      );

      expect(v$.value.totalRequestTokenAmount?.$invalid).toBe(false);
    });
    it('is invalid when request token amount exceeds user wallet balance', () => {
      const token = generateTokenSelectorOption({ decimals: 6 });
      const selectedToken = ref(token);
      const balance: Ref<TokenAmount | undefined> = ref(undefined);
      balance.value = TokenAmount.parse('0.1', token.value);

      const selectedAmount = ref('0.2');
      const selectedTokenAmount = computed(() =>
        TokenAmount.parse(selectedAmount.value, selectedToken.value.value),
      );
      const totalRequestTokenAmount = selectedTokenAmount;

      const v$ = useRequestSourceInputValidations(
        createConfig({
          selectedToken,
          selectedAmount,
          selectedTokenAmount,
          totalRequestTokenAmount,
          balance,
        }),
      );

      expect(v$.value.totalRequestTokenAmount?.$invalid).toBe(true);
    });
  });
});
