<template>
  <div class="request-form-inputs flex flex-col">
    <div class="mb-28 flex flex-row gap-5 items-center">
      <span class="text-3xl">Send</span>
      <FormKit
        type="text"
        outer-class="flex-1"
        name="amount"
        placeholder="0.00"
        validation="required"
        messages-class="hidden"
      />
      <FormKit
        type="selector"
        name="tokenAddress"
        outer-class="flex-1"
        :options="TOKENS"
        placeholder="Token"
        validation="required"
        messages-class="hidden"
      />
    </div>
    <FormKit
      outer-class="mb-16"
      type="selector"
      name="fromChainId"
      label="From"
      :options="CHAINS"
      validation="required"
      messages-class="hidden"
    />
    <div class="mb-7">
      <FormKit
        outer-class="mb-6"
        type="selector"
        name="toChainId"
        label="To"
        :options="CHAINS"
        validation="required"
        messages-class="hidden"
      />
      <FormKit
        type="text"
        outer-class="flex-1"
        name="toAddress"
        placeholder="Address"
        validation="required"
        messages-class="hidden"
      />
    </div>
    <div v-if="fees" class="self-end flex flex-row gap-5 items-center text-2xl text-light">
      <span>fees</span>
      <span> {{ fees }} ETH</span>
      <img
        v-tooltip.right="
          'This window appears when hovering the info (?) button. Here we confirm to the user that they are charged a certain fee, not an estimate. We briefly detail how this is done. We confirm that the funds they send are the funds the get on the other end.'
        "
        class="h-6 w-6 cursor-help"
        src="@/assets/images/help.svg"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { getNetwork } from '@ethersproject/providers';

import { EthereumProviderKey, RaisyncConfigKey } from '@/symbols';
import type { SelectorOption } from '@/types/form';
import { injectStrict } from '@/utils/vue-utils';

const ethereumProvider = injectStrict(EthereumProviderKey);
const raisyncConfig = injectStrict(RaisyncConfigKey);

interface Props {
  readonly fees: string;
}

defineProps<Props>();

const CHAINS: SelectorOption[] = [];
Object.keys(raisyncConfig.value.chains).forEach((chain) => {
  const chainId = Number(chain);
  const { name } = getNetwork(chainId);
  CHAINS.push({ value: chainId, label: name });
});

const TOKENS: SelectorOption[] = [];
raisyncConfig.value.chains[String(ethereumProvider.value.chainId.value)].tokens.forEach(
  (token) => {
    TOKENS.push({ value: token.address, label: token.symbol });
  },
); // TODO it would be better to fetch Token Meta data from somewhere

// TEST DATA
// const TOKENS: SelectorOption[] = [
//   // TODO value should be address of token or custom token object
//   {
//     value: 'usdc',
//     label: 'USDC',
//     imageUrl: 'src/assets/images/usdc.svg',
//   },
//   {
//     value: 'dai',
//     label: 'DAI',
//     imageUrl: 'src/assets/images/dai.svg',
//   },
// ];

// const CHAINS: SelectorOption[] = [
//   // TODO value should be chain id
//   {
//     value: 'optimism',
//     label: 'Optimism Mainnet',
//     imageUrl: 'src/assets/images/optimism.svg',
//   },
//   {
//     value: 'arbitrum',
//     label: 'Arbitrum Mainnet',
//     imageUrl: 'src/assets/images/arbitrum.svg',
//   },
// ];

// TODO validation errors should be shown, atm they are hidden (messages-class="hidden")
// TODO switch chain when from is changed by the user
// TODO prefill from with current chain

// TODO Prefill from / to rollup fields
// TODO Help tooltip text needed

// TODO Token amount input should show token balance as help
// TODO Token amount input should get a MAX button
</script>
