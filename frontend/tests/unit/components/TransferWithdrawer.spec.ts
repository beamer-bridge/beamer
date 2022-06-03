import { mount } from '@vue/test-utils';

import Spinner from '@/components/Spinner.vue';
import TransferWithdrawer from '@/components/TransferWithdrawer.vue';

function createWrapper(options?: {
  withdrawn?: boolean;
  active?: boolean;
  errorMessage?: string;
}) {
  return mount(TransferWithdrawer, {
    shallow: true,
    props: {
      withdrawn: options?.withdrawn ?? false,
      active: options?.active ?? false,
      errorMessage: options?.errorMessage,
    },
  });
}
describe('TransferWithdrawer.vue', () => {
  it('emits withdraw event when user clicks button', async () => {
    const wrapper = createWrapper();
    const button = wrapper.get('[data-test="recover-tokens-button"]');

    await button.trigger('click');

    expect(wrapper.emitted('withdraw')).toBeTruthy();
  });

  it('hides button when set to be active', () => {
    const wrapper = createWrapper({ active: true });
    const button = wrapper.find('[data-test="recover-tokens-button"]');

    expect(button.exists()).toBeFalsy();
  });

  it('shows spinner when set to be active', () => {
    const wrapper = createWrapper({ active: true });
    const spinner = wrapper.findComponent(Spinner);

    expect(spinner.exists()).toBeTruthy();
    expect(spinner.isVisible()).toBeTruthy();
  });

  it('shows given error message', () => {
    const wrapper = createWrapper({ errorMessage: 'test error' });

    expect(wrapper.text()).toContain('test error');
  });

  it('shows that tokens are withdrawn it set to be withdrawn', () => {
    const wrapper = createWrapper({ withdrawn: true });

    expect(wrapper.text()).toBe('Tokens Withdrawn');
  });
});
