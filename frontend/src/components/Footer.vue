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
    <div class="flex flex-row items-center justify-center gap-8 py-2">
      <a
        href="https://github.com/beamer-bridge"
        target="_blank"
        class="transition-transform hover:scale-110"
      >
        <img class="w-8" src="@/assets/images/social-media/github.png" />
      </a>
      <a
        href="https://discord.gg/YWdStZkz9z"
        target="_blank"
        class="transition-transform hover:scale-110"
      >
        <img class="w-8" src="@/assets/images/social-media/discord.png" />
      </a>
      <a
        href="https://twitter.com/BeamerBridge"
        target="_blank"
        class="transition-transform hover:scale-110"
      >
        <img class="w-8" src="@/assets/images/social-media/twitter.png" />
      </a>
      <a
        href="https://medium.com/@BeamerBridge"
        target="_blank"
        class="transition-transform hover:scale-110"
      >
        <img class="w-8" src="@/assets/images/social-media/medium.png" />
      </a>
    </div>
    <Version />
  </footer>
</template>

<script setup lang="ts">
import Version from '@/components/Version.vue';
</script>
