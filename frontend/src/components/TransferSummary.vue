<template>
  <div class="flex flex-col gap-5 text-center">
    <div>
      {{ date.toLocaleString() }}<br />
      You sent {{ amount }}&nbsp;{{ tokenSymbol }}<br />
      from {{ sourceChainName }}<br />
      to {{ targetChainName }}<br /><br />
      Target address:<br />
      <EthereumAddress :address="targetAccount" />
    </div>

    <div>
      <slot />
      <a
        v-if="requestTransactionUrl"
        class="underline hover:opacity-90"
        target="_blank"
        :href="requestTransactionUrl"
        data-test="explorer-link"
      >
        See transfer on the Explorer
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import EthereumAddress from '@/components/layout/EthereumAddress.vue';

interface Props {
  readonly date: Date;
  readonly amount: string;
  readonly tokenSymbol: string;
  readonly sourceChainName: string;
  readonly targetChainName: string;
  readonly targetAccount: string;
  readonly requestTransactionUrl?: string;
}

defineProps<Props>();
</script>
