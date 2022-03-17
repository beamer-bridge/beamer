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
      :value="fromChainId"
      outer-class="mb-16"
      type="selector"
      name="fromChainId"
      label="From"
      :options="CHAINS"
      validation="required"
      messages-class="hidden"
      @input="switchChain"
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
import { FormKit } from '@formkit/vue';
import { onBeforeMount, ref, watch } from 'vue';

import { BeamerConfigKey, EthereumProviderKey } from '@/symbols';
import type { SelectorOption } from '@/types/form';
import { injectStrict } from '@/utils/vue-utils';

const ethereumProvider = injectStrict(EthereumProviderKey);
const beamerConfig = injectStrict(BeamerConfigKey);

interface Props {
  readonly fees: string;
}

defineProps<Props>();

const chainsConfiguration = beamerConfig.value.chains;

const getChainSelectorOption = (chainId: string) => {
  return {
    value: Number(chainId),
    label: chainsConfiguration[chainId]?.name,
  };
};

const CHAINS: SelectorOption[] = Object.keys(chainsConfiguration).map((chainId) =>
  getChainSelectorOption(chainId),
);

const TOKENS: SelectorOption[] = chainsConfiguration[
  String(ethereumProvider.value.chainId.value)
]?.tokens.map((token) => ({ value: token.address, label: token.symbol }));

const fromChainId = ref();

const switchChain = async (chainId: any) => {
  if (chainId !== ethereumProvider.value.chainId.value) {
    try {
      const isSuccessfulSwitch = await ethereumProvider.value.switchChain(chainId.value);
      if (isSuccessfulSwitch === null) {
        await ethereumProvider.value.addChain({
          chainId: chainId.value,
          name: chainsConfiguration[chainId.value].name,
          rpcUrl: chainsConfiguration[chainId.value].rpcUrl,
        });
      }
    } catch (error) {
      location.reload();
    }
  }
};

watch(ethereumProvider.value.chainId, () => {
  location.reload();
});

onBeforeMount(() => {
  fromChainId.value = getChainSelectorOption(String(ethereumProvider.value.chainId.value));
});
</script>
