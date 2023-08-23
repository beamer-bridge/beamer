<template>
  <div class="mb-7 rounded-lg bg-teal px-3 py-2 text-center text-sm md:px-8 md:py-8">
    Low liquidity on destination chain. Your request might end up in pending state for
    {{ requestExpiryDistanceInWords }}, after which you can safely withdraw your funds.
    <br />Proceed anyway?
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns';

import { DEFAULT_REQUEST_EXPIRY_SECONDS } from '@/utils/constants';

const requestExpiryInMilliseconds =
  (parseInt(import.meta.env.VITE_REQUEST_EXPIRY_SECONDS) || DEFAULT_REQUEST_EXPIRY_SECONDS) * 1000;

const requestExpiryDistanceInWords = formatDistanceToNow(Date.now() + requestExpiryInMilliseconds);
</script>
