import './main.css';
import '@fontsource/sora';

import { createPinia } from 'pinia';
import piniaPersistState from 'pinia-plugin-persistedstate';
import { createApp } from 'vue';

import App from './App.vue';
import { toastOptions, ToastPlugin } from './plugins/vue-toastification';
import router from './router';

const pinia = createPinia();
pinia.use(piniaPersistState);

createApp(App).use(router).use(pinia).use(ToastPlugin, toastOptions).mount('#app');
