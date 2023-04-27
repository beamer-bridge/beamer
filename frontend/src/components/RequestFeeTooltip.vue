<template>
  <Tooltip>
    <div class="flex h-full flex-col justify-center" data-test="tooltip-trigger">
      <img class="h-5 w-5 cursor-help" src="@/assets/images/help.svg" />
    </div>
    <template #hint>
      <div data-test="tooltip-text">
        The fee amount is composed of two parts:<br />
        <ul class="pl-5">
          <li>• the liquidity provider fee</li>
          <li>• the protocol fee</li>
        </ul>
        <br />
        The liquidity provider fee is paid out to the liquidity provider servicing the request,
        while the protocol fee stays with the contract and supports the Beamer platform
        development.<br />
        Note that the fee is paid on top of the token amount being transferred,so that the token
        amount received on the target rollup is exactly the same as the token amount sent from the
        source rollup.
        <span v-if="formattedMinFee" data-test="formatted-minimum-fee">
          <br /><br />
          The minimum fee for a transfer is
          <span class="font-bold">{{ formattedMinFee }}</span>
        </span>
      </div>
    </template>
  </Tooltip>
</template>

<script lang="ts" setup>
import Tooltip from '@/components/layout/Tooltip.vue';

interface Props {
  formattedMinFee?: string;
}

defineProps<Props>();
</script>
