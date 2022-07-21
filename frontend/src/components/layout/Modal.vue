<template>
  <span
    class="hover:underline hover:cursor-pointer translate-x-0 translate-y-0"
    :class="triggerClasses"
    data-test="open-button"
    @click="openModal"
    >{{ triggerText }}</span
  >

  <div
    v-if="modalIsVisible"
    class="fixed top-0 left-0 w-full h-full z-10 flex justify-center items-center bg-black/40"
  >
    <div
      class="box max-w-5xl max-h-[95vh] flex flex-col overflow-auto p-14 rounded-[1rem] text-left text-light text-base bg-dark"
      data-test="content-box"
    >
      <slot />
      <button
        class="border border-white rounded-md px-4 py-2 hover:bg-teal-light place-self-end"
        data-test="close-button"
        @click="closeModal"
      >
        OK
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  triggerText: string;
  triggerClasses?: string;
}

defineProps<Props>();

const modalIsVisible = ref(false);

function openModal() {
  modalIsVisible.value = true;
}

function closeModal() {
  modalIsVisible.value = false;
}
</script>

<style lang="css">
.box::-webkit-scrollbar {
  width: 6px;
}

.box::-webkit-scrollbar-track {
  @apply bg-teal my-4;
}

.box::-webkit-scrollbar-thumb {
  @apply bg-teal-light-35;
}
</style>
