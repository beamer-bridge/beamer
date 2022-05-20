import { mount } from '@vue/test-utils';

import Expandable from '@/components/layout/Expandable.vue';

function createWrapper(options?: {
  isExpanded?: boolean;
  headerSlot?: string;
  bodySlot?: string;
}) {
  return mount(Expandable, {
    shallow: true,
    props: {
      isExpanded: options?.isExpanded,
    },
    slots: {
      header: options?.headerSlot ?? '',
      body: options?.bodySlot ?? '',
    },
  });
}

describe('Expandable.vue', () => {
  beforeEach(() => {
    global.window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('always renders header slot', () => {
    const wrapper = createWrapper({ headerSlot: 'test header' });
    const header = wrapper.get('[data-test="header"]');

    expect(header.text()).toContain('test header');
  });

  it('hides body slot per default', () => {
    const wrapper = createWrapper();
    const body = wrapper.find('[data-test="body"]');

    expect(body.exists()).toBeFalsy();
  });

  it('can open body on initial render via property', () => {
    const wrapper = createWrapper({ isExpanded: true });
    const body = wrapper.find('[data-test="body"]');

    expect(body.exists()).toBeTruthy();
  });

  it('can open and close body when clicking the header', async () => {
    const wrapper = createWrapper();
    const header = wrapper.get('[data-test="header"]');

    expect(wrapper.find('[data-test="body"]').exists()).toBeFalsy();
    await header.trigger('click');
    expect(wrapper.find('[data-test="body"]').exists()).toBeTruthy();
    await header.trigger('click');
    expect(wrapper.find('[data-test="body"]').exists()).toBeFalsy();
  });

  it('can close open body with changing property', async () => {
    const wrapper = createWrapper({ isExpanded: false });

    expect(wrapper.find('[data-test="body"]').exists()).toBeFalsy();
    await wrapper.setProps({ isExpanded: true });
    expect(wrapper.find('[data-test="body"]').exists()).toBeTruthy();
    await wrapper.setProps({ isExpanded: false });
    expect(wrapper.find('[data-test="body"]').exists()).toBeFalsy();
  });

  it('body renders given slot content', () => {
    const wrapper = createWrapper({ isExpanded: true, bodySlot: 'body content' });
    const body = wrapper.get('[data-test="body"]');

    expect(body.text()).toContain('body content');
  });

  it('triggers browser to scroll element into view when expanding', async () => {
    const wrapper = createWrapper();
    const header = wrapper.get('[data-test="header"]');

    await header.trigger('click');

    expect(global.window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledOnce();
  });
});
