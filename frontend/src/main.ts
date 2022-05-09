import './main.css';
import '@fontsource/sora';
import 'vue-select/dist/vue-select.css';
import 'floating-vue/dist/style.css';

import {
  createInput,
  defaultConfig as formkitConfig,
  plugin as formkitPlugin,
} from '@formkit/vue';
import FloatingVue from 'floating-vue';
import { createPinia } from 'pinia';
import piniaPersist from 'pinia-plugin-persist';
import { createApp } from 'vue';

import App from './App.vue';
import Selector from './components/inputs/Selector.vue';
import formkitTheme from './formkitTheme';
import router from './router';

const pinia = createPinia();
pinia.use(piniaPersist);

createApp(App)
  .use(router)
  .use(
    formkitPlugin,
    formkitConfig({
      plugins: [formkitTheme],
      inputs: {
        selector: createInput(Selector, {
          props: ['options'],
        }),
      },
    }),
  )
  .use(FloatingVue)
  .use(pinia)
  .mount('#app');
