<template>
  <footer class="absolute bottom-0 my-4 text-lg text-center text-sea-green right-0 left-0">
    <div>
      Powered by
      <a href="https://beamerbridge.com" target="_blank" class="hover:underline">Beamer</a>
      &bull;
      <a href="https://beamerbridge.com/imprint.html" target="_blank" class="hover:underline"
        >Imprint</a
      >
      &bull;
      <a href="https://beamerbridge.com/terms.html" target="_blank" class="hover:underline"
        >Terms of Service</a
      >
    </div>
    <Version />
  </footer>
</template>

<script setup lang="ts">
import Version from '@/components/Version.vue';
</script>
