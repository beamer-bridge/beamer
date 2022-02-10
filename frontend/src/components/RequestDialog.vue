<template>
  <div class="request-dialog">
    <div v-if="successfulTransactionUrl">
      Request successful! Click
      <a :href="successfulTransactionUrl" target="_blank" class="request-dialog__link">here</a>
      to see transaction details.
    </div>
    <RequestForm
      v-else
      class="request-dialog__form"
      :loading="executingRequest"
      @form-accepted="executeRequestTransaction"
    />
    <div v-if="transactionErrorMessage" class="request-dialog__error">
      {{ transactionErrorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import RequestForm from '@/components/RequestForm.vue';
import useRequestTransaction from '@/composables/useRequestTransaction';
import { EthereumProviderKey, RaisyncConfigKey } from '@/symbols';
import { injectStrict } from '@/utils/vue-utils';

const ethereumProvider = injectStrict(EthereumProviderKey);
const raisyncConfig = injectStrict(RaisyncConfigKey);

const {
  executingRequest,
  transactionErrorMessage,
  successfulTransactionUrl,
  executeRequestTransaction,
} = useRequestTransaction(ethereumProvider, raisyncConfig.value);
</script>

<style scoped lang="scss">
@import '@/scss/colors';

.request-dialog {
  &__form {
    margin: 30px;
  }

  &__error {
    color: $error-color;
  }

  &__link {
    color: $primary;
  }
}
</style>
