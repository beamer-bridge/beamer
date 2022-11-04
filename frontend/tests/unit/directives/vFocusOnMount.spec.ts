import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import type { Param } from '@/directives/vFocusOnMount';
import { vFocusOnMount } from '@/directives/vFocusOnMount';

const createComponent = (focusOnMountActive: Param = true) =>
  defineComponent({
    directives: {
      FocusOnMount: vFocusOnMount,
    },
    data() {
      return {
        focusOnMountActive,
      };
    },
    template: `<div>
    <input v-focusOnMount="focusOnMountActive" data-test='focused-input'/>
  </div>`,
  });

const createWrapper = (component = createComponent()) => {
  return mount(component, {
    global: {
      directives: {
        vFocusOnMount,
      },
    },
    attachTo: document.body,
  });
};

describe('vFocusOnMount', () => {
  describe('in active state', () => {
    const focusOnMountActive = true;
    it('focuses the element', () => {
      const component = createComponent(focusOnMountActive);
      const wrapper = createWrapper(component);

      const focusedElement = wrapper.find('[data-test="focused-input"]').element;
      expect(focusedElement).toBe(document.activeElement);
    });
  });

  describe('in inactive state', () => {
    const focusOnMountActive = false;
    it('does not trigger a focus on the element', () => {
      const component = createComponent(focusOnMountActive);
      const wrapper = createWrapper(component);

      const focusedElement = wrapper.find('[data-test="focused-input"]').element;
      expect(focusedElement).not.toBe(document.activeElement);
    });
  });
});
