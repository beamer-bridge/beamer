<template>
  <footer class="my-8 text-center text-lg text-sea-green">
    <div>
      Powered by
      <a href="https://beamerbridge.com" target="_blank" class="hover:underline">Beamer</a>
      &bull;
      <a
        href="https://beamerbridge.com/imprint.html"
        target="_blank"
        class="hover:underline"
        data-test="imprint-link"
        >Imprint</a
      >
      &bull;
      <a
        href="https://beamerbridge.com/terms.html"
        target="_blank"
        class="hover:underline"
        data-test="tos-link"
        >Terms of Service</a
      >
    </div>
    <div class="flex flex-row items-center justify-center gap-8 py-2">
      <a
        href="https://github.com/beamer-bridge"
        target="_blank"
        class="transition-transform hover:scale-110"
        data-test="github-link"
      >
        <img class="w-8" src="@/assets/images/social-media/github.png" />
      </a>
      <a
        href="https://discord.gg/beamerbridge"
        target="_blank"
        class="transition-transform hover:scale-110"
        data-test="discord-link"
      >
        <img class="w-8" src="@/assets/images/social-media/discord.png" />
      </a>
      <a
        href="https://twitter.com/BeamerBridge"
        target="_blank"
        class="transition-transform hover:scale-110"
        data-test="twitter-link"
      >
        <img class="w-8" src="@/assets/images/social-media/twitter.png" />
      </a>
      <a
        href="https://medium.com/@BeamerBridge"
        target="_blank"
        class="transition-transform hover:scale-110"
        data-test="medium-link"
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
