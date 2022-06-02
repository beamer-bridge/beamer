<template>
  <div class="flex flex-col gap-5 text-center">
    <div>
      {{ date.toLocaleString() }}<br />
      You sent {{ amount }}&nbsp;{{ tokenSymbol }}<br />
      from {{ sourceChainName }} to {{ targetChainName }}<br />
    </div>

    <div>
      Target address:<br />
      {{ targetAccount }}
    </div>

    <a
      v-if="requestTransactionUrl"
      class="underline"
      :href="requestTransactionUrl"
      data-test="explorer-link"
    >
      See transfer on the Explorer
    </a>
  </div>
</template>

<script setup lang="ts">
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
