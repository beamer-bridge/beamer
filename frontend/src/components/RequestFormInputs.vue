<template>
  <div class="request-form-inputs flex flex-col">
    <div class="mb-28 flex flex-row gap-5 items-center">
      <span class="text-3xl">Send</span>
      <FormKit type="text" outer-class="flex-1" name="amount" placeholder="0.00" />
      <FormKit type="selector" outer-class="flex-1" :options="TOKENS" placeholder="Token" />
    </div>
    <FormKit outer-class="mb-16" type="selector" label="From" :options="CHAINS" />
    <div class="mb-7">
      <FormKit outer-class="mb-6" type="selector" label="To" :options="CHAINS" />
      <FormKit type="text" outer-class="flex-1" name="toAddress" placeholder="Address" />
    </div>
    <div class="self-end flex flex-row gap-5 items-center text-2xl text-light">
      <span>fees</span>
      <span>TODO ETH</span>
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
import type { SelectorOption } from '@/types/form';

const TOKENS: SelectorOption[] = [
  // TODO value should be address of token or custom token object
  {
    value: 'usdc',
    label: 'USDC',
    imageUrl: 'src/assets/images/usdc.svg',
  },
  {
    value: 'dai',
    label: 'DAI',
    imageUrl: 'src/assets/images/dai.svg',
  },
];

const CHAINS: SelectorOption[] = [
  // TODO value should be chain id
  {
    value: 'optimism',
    label: 'Optimism Mainnet',
    imageUrl: 'src/assets/images/optimism.svg',
  },
  {
    value: 'arbitrum',
    label: 'Arbitrum Mainnet',
    imageUrl: 'src/assets/images/arbitrum.svg',
  },
];

// TODO Prefill from / to rollup fields

// TODO Token amount input should show token balance as help
// TODO Token amount input should get a MAX button
</script>
