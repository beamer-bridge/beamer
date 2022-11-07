import { mount } from '@vue/test-utils';

import BasicInput from '@/components/inputs/BasicInput.vue';
import * as directives from '@/directives/vFocusOnMount';
import { createMockedFocusOnMountDirective } from '~/utils/mocks/directives';

function createWrapper(options?: {
  modelValue?: string;
  focusOnMount?: boolean;
  attachToBody?: boolean;
  valid?: boolean;
  alignRight?: boolean;
}) {
  return mount(BasicInput, {
    shallow: true,
    props: {
      modelValue: options?.modelValue ?? '',
      focusOnMount: options?.focusOnMount ?? false,
      valid: options?.valid ?? undefined,
      alignRight: options?.alignRight ?? undefined,
    },
    attachTo: options?.attachToBody ? document.body : undefined,
  });
}

describe('BasicInput.vue', () => {
  beforeEach(() => {
    Object.defineProperty(directives, 'vFocusOnMount', {
      value: createMockedFocusOnMountDirective(),
    });
  });
  it('shows an input field', () => {
    const wrapper = createWrapper();

    expect(wrapper.get('input'));
  });

  it('properly communicates when user has entered a character', () => {
    const wrapper = createWrapper();
    const input = wrapper.find('input');
    input.setValue('100');
    const messages = wrapper.emitted()['update:modelValue'];
    expect(messages).toEqual([['100']]);
  });

  it('properly attaches focus directive for focusing on mount', () => {
    const mounted = vi.fn();

    Object.defineProperty(directives, 'vFocusOnMount', {
      value: createMockedFocusOnMountDirective({ mounted }),
    });

    createWrapper({ focusOnMount: true, attachToBody: true });
    expect(mounted).toHaveBeenCalled();
  });

  describe('validation', () => {
    it('is marked as valid by default', () => {
      const wrapper = createWrapper();
      expect(wrapper.props()).toContain({ valid: true });
    });
    it('is marked as invalid when `valid` prop is set to false', () => {
      const wrapper = createWrapper({ valid: false });
      expect(wrapper.props()).toContain({ valid: false });
    });
  });

  describe('text align', () => {
    it('is aligned to left by default', () => {
      const wrapper = createWrapper();
      expect(wrapper.props()).toContain({ alignRight: false });
    });
    it('is aligned to right when `alignRight` props is set to true', () => {
      const wrapper = createWrapper({ alignRight: true });
      expect(wrapper.props()).toContain({ alignRight: true });
    });
  });
});
