<template>
  <div class="flex flex-col justify-center items-center">
    <div>
      {{ date.toLocaleString() }}<br />
      You sent {{ amount }}&nbsp;{{ tokenSymbol }}<br />
      from {{ sourceChainName }} to {{ targetChainName }}<br />
    </div>
    <div>
      from <span>{{ sourceChainName }}</span>
    </div>
    <div>
      to <span>{{ targetChainName }}</span>
    </div>
  </div>
  <div class="flex flex-col justify-center items-center">
    <div>Recipient address</div>
    <div>{{ targetAccount }}</div>
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
}

defineProps<Props>();
</script>
