<template>
  <div v-if="visible" class="text-xs">
    Build version:
    <a :href="gitRepositoryAtCommitURL" target="_blank" class="underline" data-test="version">
      {{ version }}
    </a>
  </div>
</template>

<script lang="ts" setup>
const commitHash = APP_RELEASE.COMMIT_HASH;
const version = APP_RELEASE.VERSION;
const gitRepositoryURL = APP_RELEASE.REPOSITORY;

const gitRepositoryAtCommitURL = `${gitRepositoryURL}/tree/${commitHash}`;

const visible = commitHash && import.meta.env.MODE !== 'development';
</script>
