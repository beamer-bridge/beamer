<template>
  <Card class="bg-teal-light p-10">
    <div class="flex flex-col justify-center items-center gap-4 text-black text-lg">
      <div class="flex flex-col justify-center items-center">
        <div>
          Sending <span>{{ amount }}</span> <span>DAI</span>
        </div>
        <div>from <span>Goerli</span></div>
        <div>to <span>Goerli</span></div>
      </div>
      <div class="flex flex-col justify-center items-center">
        <div>Recipient address</div>
        <div>{{ targetAddress }}</div>
      </div>
    </div>
  </Card>
  <div class="flex flex-col justify-center items-center">
    <div>
      <ul class="steps steps-vertical">
        <li data-content="" class="step step-success">Please confirm on Metamask</li>
        <li data-content="" class="step step-warning">Request is being fulfilled</li>
        <li data-content="" class="step">
          <div class="flex flex-col justify-start items-start">
            <div>Please switch chain connection to verify funds reception</div>
            <div class="text-orange-light">Chain switch failed. Try again.</div>
          </div>
        </li>
        <li data-content="" class="step">Verifying...</li>
        <li data-content="" class="step">Transfer completed</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from './layout/Card.vue';

interface Props {
  readonly targetAddress: string;
  readonly amount: string;
}

defineProps<Props>();
</script>
