import { onActivated, onDeactivated, onMounted, ref } from 'vue';

export function useToggleOnActivation() {
  const activated = ref(false);

  onMounted(() => (activated.value = true));
  onActivated(() => (activated.value = true));
  onDeactivated(() => (activated.value = false));

  return { activated };
}
