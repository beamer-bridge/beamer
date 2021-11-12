<template>
  <div class="view">
    <router-view class="view__route" />
  </div>
</template>

<style lang="scss">
@import '@/scss/colors';

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: $text-color;
  background: linear-gradient(90deg, $primary, $dark-background-color);
  width: 100%;
  min-height: 100vh;
  display: flex;
}

.view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;

  &__route {
    background-color: $background-color;
    border-radius: 10px;
    font-size: 18px;
    line-height: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 32px 24px 32px;
    max-width: 554px;
  }
}
</style>
