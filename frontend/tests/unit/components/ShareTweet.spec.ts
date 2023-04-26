import { shallowMount } from '@vue/test-utils';
import { ref } from 'vue';

import ShareTweet from '@/components/ShareTweet.vue';
import {
  generateRequestFulfillmentData,
  generateRequestInformationData,
  generateTransfer,
} from '~/utils/data_generators';

describe('ShareTweet.vue', () => {
  it('allows the user to share the stats of the transfer request', () => {
    const transfer = generateTransfer({
      transferData: {
        requestInformation: generateRequestInformationData({ timestamp: 1 }),
        requestFulfillment: generateRequestFulfillmentData({ timestamp: 100 }),
      },
    });

    const wrapper = shallowMount(ShareTweet, {
      props: {
        transfer,
      },
    });

    const ctaEl = wrapper.find('[data-test="cta"]');
    expect(ctaEl.attributes('href')).toContain('twitter.com/intent/tweet');
  });

  it('does not render anything when the transfer object is not shareable', async () => {
    const transfer = ref(
      generateTransfer({
        transferData: {
          requestFulfillment: generateRequestFulfillmentData({ timestamp: undefined }),
          requestInformation: generateRequestInformationData({ timestamp: undefined }),
        },
      }),
    );

    const wrapper = shallowMount(ShareTweet, {
      props: {
        transfer: transfer.value,
      },
    });

    expect(wrapper.find('[data-test="cta"]').exists()).toBe(false);

    transfer.value.requestInformation?.setTimestamp(10);
    transfer.value.requestFulfillment?.setTimestamp(100);

    wrapper.vm.$nextTick(() => {
      expect(wrapper.find('[data-test="cta"]').exists()).toBe(true);
    });
  });
});
