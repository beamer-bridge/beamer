import '@/assets/scss/vue-toastification.scss';

import type { PluginOptions } from 'vue-toastification';
import { POSITION } from 'vue-toastification';

export const toastOptions: PluginOptions = {
  position: POSITION.TOP_RIGHT,
  container: () => document.querySelector('#app') as HTMLElement,
  containerClassName: 'md:!pt-16 !pt-20', // remove padding when Banner has been removed
  toastClassName: '!rounded-lg',
  toastDefaults: {
    success: {},
    error: {},
    warning: {},
  },
  timeout: 10000,
  hideProgressBar: true,
  closeOnClick: false,
};

export { default as ToastPlugin } from 'vue-toastification';
