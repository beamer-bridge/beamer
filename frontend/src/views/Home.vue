<template>
  <div class="home">
    <h1 class="home__title">Request</h1>
    <RequestForm :loading="false" />
  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

import RequestForm from '@/components/RequestForm.vue'; // @ is an alias to /src

@Options({
  components: {
    RequestForm,
  },
})
export default class Home extends Vue {}
</script>

<style lang="scss" scoped>
.home {
  width: 600px;

  &__title {
    font-size: 36px;
    line-height: 48px;
    margin-bottom: 32px;
  }
}
</style>
