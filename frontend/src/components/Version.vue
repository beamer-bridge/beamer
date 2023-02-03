<template>
  <div v-if="commitHash" class="text-xs">
    Build version:
    <a :href="gitRepositoryAtCommitURL" target="_blank" class="underline" data-test="commit-hash">
      {{ commitHash }}
    </a>
  </div>
</template>

<script lang="ts" setup>
const commitHash = APP_RELEASE.COMMIT_HASH;
const gitRepositoryURL = APP_RELEASE.REPOSITORY;

const gitRepositoryAtCommitURL = `${gitRepositoryURL}/tree/${commitHash}`;
</script>
