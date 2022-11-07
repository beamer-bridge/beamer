import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { ref } from 'vue';

import BasicInput from '@/components/inputs/BasicInput.vue';
import NumericInput from '@/components/inputs/NumericInput.vue';
import { ALPHABET_CHARACTERS, DECIMAL_CHARACTERS } from '~/utils/data_generators';

function stubBasicInput(): Component {
  return {
    setup() {
      const inputElement = ref();
      return {
        inputElement,
      };
    },
    props: ['modelValue', 'focusOnMount', 'valid', 'alignRight'],
    template: `<input ref='inputElement'/>`,
    expose: ['inputElement'],
  };
}

function createWrapper(options?: {
  modelValue?: string;
  focusOnMount?: boolean;
  attachToBody?: boolean;
  valid?: boolean;
  alignRight?: boolean;
}) {
  return mount(NumericInput, {
    shallow: true,
    global: {
      stubs: {
        BasicInput: stubBasicInput(),
      },
    },
    props: {
      modelValue: options?.modelValue ?? '',
      focusOnMount: options?.focusOnMount ?? false,
      valid: options?.valid ?? undefined,
      alignRight: options?.alignRight ?? undefined,
    },
    attachTo: options?.attachToBody ? document.body : undefined,
  });
}

describe('NumericInput.vue', () => {
  it('renders the basic input component', () => {
    const wrapper = createWrapper();

    expect(wrapper.findComponent(BasicInput).exists());
  });

  it('properly passes all props to basic input component', () => {
    const props = {
      modelValue: 'test',
      focusOnMount: true,
      valid: true,
      alignRight: false,
    };
    const wrapper = createWrapper(props);

    const basicInputComponent = wrapper.findComponent(BasicInput);
    expect(basicInputComponent.props()).toEqual(props);
  });

  it('transforms delimiter `,` into `.`', async () => {
    const wrapper = createWrapper();
    const input = wrapper.find('input');

    await input.setValue(',');
    const messages = wrapper.emitted()['update:modelValue'];
    expect(messages).toEqual([['.']]);
  });

  describe('enforces numeric input', () => {
    const numerics = DECIMAL_CHARACTERS.split('');
    test.each(numerics)('allows input(%s)', async (number) => {
      const wrapper = createWrapper();
      const input = wrapper.find('input');

      await input.setValue(number);
      const messages = wrapper.emitted()['update:modelValue'];
      expect(messages).toEqual([[number]]);
    });

    const delimiters = [',', '.'];
    test.each(delimiters)('allows delimiter input(%s)', async (char) => {
      const wrapper = createWrapper();
      const input = wrapper.find('input');

      await input.setValue(char);
      const messages = wrapper.emitted()['update:modelValue'];
      expect(messages).toEqual([['.']]);
    });

    const alphabetCharacters = ALPHABET_CHARACTERS.split('');
    test.each(alphabetCharacters)('forbids input(%s)', async (char) => {
      const wrapper = createWrapper();
      const input = wrapper.find('input');

      await input.setValue(char);
      const messages = wrapper.emitted()['update:modelValue'];
      expect(messages).not.toBeDefined();
    });
  });
});
