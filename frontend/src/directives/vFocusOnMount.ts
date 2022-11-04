import type { DirectiveBinding, ObjectDirective } from 'vue';

export type Param = boolean;

export const vFocusOnMount: ObjectDirective<HTMLElement, Param> = {
  mounted: (el: HTMLElement, binding: DirectiveBinding<boolean>) => {
    if (binding.value) {
      el.focus();
    }
  },
};
