import '@/assets/scss/vue-toastification.scss';

import type { PluginOptions } from 'vue-toastification';
import { POSITION } from 'vue-toastification';

export const toastOptions: PluginOptions = {
  position: POSITION.TOP_RIGHT,
  container: () => document.querySelector('#app') as HTMLElement,
  toastClassName: '!rounded-lg',
  toastDefaults: {
    success: {},
    error: {},
    warning: {},
  },
};

export { default as ToastPlugin } from 'vue-toastification';
