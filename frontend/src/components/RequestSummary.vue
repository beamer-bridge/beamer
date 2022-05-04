<template>
  <div class="flex flex-col justify-center items-center">
    <div>
      Sending <span>{{ Number(amount).toFixed(2) }}&nbsp;</span>
      <span>{{ tokenSymbol }}</span>
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
    <div>{{ targetAddress }}</div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  readonly amount: string;
  readonly tokenSymbol: string;
  readonly sourceChainName: string;
  readonly targetChainName: string;
  readonly targetAddress: string;
}

defineProps<Props>();
</script>
