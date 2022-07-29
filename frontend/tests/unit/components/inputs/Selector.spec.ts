import { mount } from '@vue/test-utils';

import Input from '@/components/inputs/Input.vue';
import Selector from '@/components/inputs/Selector.vue';
import type { SelectorOption } from '@/types/form';

const testOptions: SelectorOption<number>[] = [];
for (let i = 0; i < 10; i++) {
  testOptions.push({ label: `Label ${i}`, value: i });
}

function createWrapper(options?: {
  modelValue?: SelectorOption<unknown>;
  options?: SelectorOption<unknown>[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}) {
  return mount(Selector, {
    shallow: true,
    props: {
      modelValue: options?.modelValue ?? null,
      options: options?.options ?? testOptions,
      placeholder: options?.placeholder ?? 'Placeholder',
      disabled: options?.disabled,
      label: options?.label,
    },
  });
}

describe('Selector.vue', () => {
  it('displays the options when opened', async () => {
    const wrapper = createWrapper();
    const trigger = wrapper.find('[data-test="open-trigger"]');

    await trigger.trigger('click');
    const optionList = wrapper.get('[data-test="option-list"');
    const optionElements = wrapper.findAll('[data-test="option"]');

    expect(optionElements).toHaveLength(testOptions.length);
    for (const testOption of testOptions) {
      expect(optionList.text()).toContain(testOption.label);
    }
  });

  it('can select an element', async () => {
    const option: SelectorOption<number> = {
      label: 'Label 1',
      value: 1,
    };

    const wrapper = createWrapper({ options: [option] });
    const trigger = wrapper.find('[data-test="open-trigger"]');

    await trigger.trigger('click');
    const optionElement = wrapper.get('[data-test="option"]');

    await optionElement.trigger('click');
    const optionList = wrapper.find('[data-test="option-list"');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([option]);
    expect(optionList.exists()).toBe(false);
  });

  it('can filter the displayed options', async () => {
    const wrapper = createWrapper();
    const trigger = wrapper.find('[data-test="open-trigger"]');

    await trigger.trigger('click');
    const optionList = wrapper.get('[data-test="option-list"');
    const searchField = optionList.findComponent(Input);
    await searchField.vm.$emit('update:modelValue', testOptions[0].label);

    const optionElements = wrapper.findAll('[data-test="option"]');

    expect(optionElements).toHaveLength(1);
    expect(optionElements[0].text()).toContain(testOptions[0].label);
  });

  it('displays the selected option when set as v-model', () => {
    const wrapper = createWrapper({ modelValue: testOptions[0] });

    const selector = wrapper.find('[data-test="open-trigger"]');

    expect(selector.text()).toContain(testOptions[0].label);
  });

  it('displays a placeholder', () => {
    const placeholder = 'Select number';
    const wrapper = createWrapper({ placeholder });

    const selector = wrapper.find('[data-test="open-trigger"]');

    expect(selector.text()).toContain(placeholder);
  });

  it('should not open when disabled', async () => {
    const wrapper = createWrapper({ disabled: true });
    const trigger = wrapper.find('[data-test="open-trigger"]');

    await trigger.trigger('click');
    const optionList = wrapper.find('[data-test="option-list"');

    expect(optionList.exists()).toBe(false);
  });

  it('shows the label when opened', async () => {
    const label = 'Numbers';
    const wrapper = createWrapper({ label });
    const trigger = wrapper.find('[data-test="open-trigger"]');

    await trigger.trigger('click');
    const optionList = wrapper.get('[data-test="option-list"');

    expect(optionList.text()).toContain(label);
  });

  it('should close the selector by escape key', async () => {
    const wrapper = createWrapper();
    const trigger = wrapper.find('[data-test="open-trigger"]');

    await trigger.trigger('click');

    let optionList = wrapper.find('[data-test="option-list"');
    await optionList.trigger('keyup.esc');

    optionList = wrapper.find('[data-test="option-list"');

    expect(optionList.exists()).toBe(false);
  });
});
