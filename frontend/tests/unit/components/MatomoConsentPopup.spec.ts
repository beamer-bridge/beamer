import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';

import MatomoConsentPopup from '@/components/MatomoConsentPopup.vue';
import { useSettings } from '@/stores/settings';

describe('MatomoConsentPopup.vue', () => {
  let _paq: unknown[];

  beforeEach(() => {
    _paq = [];
    Object.defineProperty(global.window, '_paq', { value: _paq, writable: true });
  });

  async function createWrapper() {
    const wrapper = mount(MatomoConsentPopup, {
      shallow: true,
      global: {
        plugins: [createTestingPinia()],
      },
    });

    const init = _paq.pop() as Array<() => void>;
    const context = { getRememberedConsent: () => null };
    init[0].bind(context)();
    await wrapper.vm.$nextTick();

    return wrapper;
  }

  it('allows to give consent', async () => {
    const wrapper = await createWrapper();

    const trigger = wrapper.find('[data-test="accept-consent"]');
    await trigger.trigger('click');

    expect(_paq).toHaveLength(1);
    expect(_paq[0]).toEqual(['rememberConsentGiven']);
    expect(wrapper.find('[data-test="consent-popup"]').exists()).toBeFalsy();
  });

  it('allows to decline consent', async () => {
    const wrapper = await createWrapper();
    const settings = useSettings();

    const trigger = wrapper.find('[data-test="decline-consent"]');
    await trigger.trigger('click');

    expect(_paq).toHaveLength(0);
    expect(wrapper.find('[data-test="consent-popup"]').exists()).toBeFalsy();
    expect(settings.matomoConsentDeclined).toBe(true);
  });
});
