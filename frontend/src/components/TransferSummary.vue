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

    <div v-if="statusLabel.length > 0">
      Status:
      <span :class="statusClasses">{{ statusLabel }}</span>
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
import { computed } from 'vue';

interface Props {
  readonly date: Date;
  readonly amount: string;
  readonly tokenSymbol: string;
  readonly sourceChainName: string;
  readonly targetChainName: string;
  readonly targetAccount: string;
  readonly statusLabel: string;
  readonly statusColor?: string;
  readonly requestTransactionUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
  statusColor: 'black',
  requestTransactionUrl: undefined,
});

const statusClasses = computed(() => [`text-${props.statusColor}`]);
</script>
