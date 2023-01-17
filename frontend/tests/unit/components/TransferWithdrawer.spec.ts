import { mount } from '@vue/test-utils';

import Spinner from '@/components/Spinner.vue';
import TransferWithdrawer from '@/components/TransferWithdrawer.vue';

function createWrapper(options?: {
  withdrawn?: boolean;
  withdrawable?: boolean;
  withdrawInProgress?: boolean;
  errorMessage?: string;
}) {
  return mount(TransferWithdrawer, {
    shallow: true,
    global: {
      stubs: {
        Tooltip: {
          template: `<div><slot/><slot name="hint"/></div>`,
        },
      },
    },
    props: {
      withdrawn: options?.withdrawn ?? false,
      withdrawable: options?.withdrawable ?? true,
      withdrawInProgress: options?.withdrawInProgress ?? false,
      errorMessage: options?.errorMessage,
    },
  });
}
describe('TransferWithdrawer.vue', () => {
  it('emits withdraw event when user clicks button', async () => {
    const wrapper = createWrapper({ withdrawable: true });
    const button = wrapper.get('[data-test="recover-tokens-button"]');

    await button.trigger('click');

    expect(wrapper.emitted('withdraw')).toBeTruthy();
  });

  it('hides button when a withdraw is in progress', () => {
    const wrapper = createWrapper({ withdrawInProgress: true });
    const button = wrapper.find('[data-test="recover-tokens-button"]');

    expect(button.exists()).toBeFalsy();
  });

  it('shows spinner when a withdraw is in progress', () => {
    const wrapper = createWrapper({ withdrawInProgress: true });
    const spinner = wrapper.findComponent(Spinner);

    expect(spinner.exists()).toBeTruthy();
    expect(spinner.isVisible()).toBeTruthy();
  });

  it('shows given error message', () => {
    const wrapper = createWrapper({ errorMessage: 'test error' });

    expect(wrapper.text()).toContain('test error');
  });

  it('shows that tokens are withdrawn if set to be withdrawn', () => {
    const wrapper = createWrapper({ withdrawn: true });

    expect(wrapper.text()).toBe('Tokens Withdrawn');
  });

  describe('when withdrawable is set to false', () => {
    it('shows a simple message indicating the status', () => {
      const wrapper = createWrapper({
        withdrawable: false,
      });

      const messageElement = wrapper.find('[data-test="dispute-message"]');

      expect(messageElement.text()).toContain('Waiting for dispute resolution');
    });

    it('shows a tooltip message explaining the status', () => {
      const wrapper = createWrapper({
        withdrawable: false,
      });

      const descriptionElement = wrapper.find('[data-test="dispute-description"]');

      expect(descriptionElement.text()).toContain(
        'Someone claimed that the request has been filled on your destination rollup.',
      );
    });
  });
});
