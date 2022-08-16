import { mount } from '@vue/test-utils';

import Input from '@/components/inputs/Input.vue';

function createWrapper(options?: {
  modelValue?: string;
  focusOnMount?: boolean;
  attachToBody?: boolean;
  type?: string;
  valid?: boolean;
  alignRight?: boolean;
}) {
  return mount(Input, {
    shallow: true,
    props: {
      modelValue: options?.modelValue ?? '',
      type: options?.type ?? undefined,
      focusOnMount: options?.focusOnMount ?? false,
      valid: options?.valid ?? undefined,
      alignRight: options?.alignRight ?? undefined,
    },
    attachTo: options?.attachToBody ? document.body : undefined,
  });
}

describe('Input.vue', () => {
  it('shows an input field', () => {
    const wrapper = createWrapper();

    expect(wrapper.get('input'));
  });

  it('properly communicates when user has entered a character', () => {
    const wrapper = createWrapper({
      type: 'number',
    });
    const input = wrapper.find('input');
    input.setValue('100');
    const messages = wrapper.emitted()['update:modelValue'];
    expect(messages).toEqual([['100']]);
  });

  it('properly defines input type attribute based on passed props', () => {
    const wrapper = createWrapper({
      type: 'number',
    });
    const input = wrapper.find('input');
    expect(input.attributes('type')).toContain('number');
  });

  it('falls back to type "text" when no type is provided via props', () => {
    const wrapper = createWrapper({
      type: undefined,
    });
    const input = wrapper.find('input');
    expect(input.attributes('type')).toContain('text');
  });

  it('focuses on mount', () => {
    const wrapper = createWrapper({ focusOnMount: true, attachToBody: true });
    const inputElement = wrapper.get('input[type="text"]').element;

    expect(inputElement).toBe(document.activeElement);
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
