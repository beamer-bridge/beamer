import { mount } from '@vue/test-utils';

import Modal from '@/components/layout/Modal.vue';

function createWrapper() {
  return mount(Modal, {
    shallow: true,
    props: {
      triggerText: 'trigger',
    },
  });
}
describe('Modal.vue', () => {
  /*
   * Having this ugly open-and-close test is not so nice. Unfortunately because
   * the opening state variable can't be modified, this is the "only" way to
   * test it right now.
   */
  it('can open and close content box', async () => {
    const wrapper = createWrapper();
    const openButton = wrapper.find('[data-test="open-button"]');

    expect(openButton.exists()).toBeTruthy();
    expect(wrapper.find('[data-test="content-box"]').exists()).toBeFalsy();

    await openButton.trigger('click');
    const closeButton = wrapper.find('[data-test="close-button"]');

    expect(wrapper.find('[data-test="content-box"]').exists()).toBeTruthy();
    expect(closeButton.exists()).toBeTruthy();

    await closeButton.trigger('click');

    expect(wrapper.find('[data-test="content-box"]').exists()).toBeFalsy();
  });

  it('renders some content when opened', async () => {
    const wrapper = createWrapper();
    const openButton = wrapper.get('[data-test="open-button"]');
    await openButton.trigger('click');
    const contentBox = wrapper.get('[data-test="content-box"]');

    expect(contentBox.text().length).toBeGreaterThan(0);
  });
});
