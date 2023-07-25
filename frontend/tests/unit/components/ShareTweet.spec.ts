import { shallowMount } from '@vue/test-utils';
import { ref } from 'vue';

import ShareTweet from '@/components/ShareTweet.vue';
import {
  generateChain,
  generateRequestFulfillmentData,
  generateRequestInformationData,
  generateTokenAmountData,
  generateTransfer,
  generateTransferData,
  generateUInt256Data,
  getRandomEthereumAddress,
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

  it('renders some text with a link to beamer website when transfer is shareable', () => {
    const transfer = generateTransfer({
      transferData: generateTransferData({
        requestInformation: generateRequestInformationData({ timestamp: 1 }),
        requestFulfillment: generateRequestFulfillmentData({ timestamp: 100 }),
      }),
    });

    const wrapper = shallowMount(ShareTweet, {
      props: {
        transfer,
      },
    });

    const ctaEl = wrapper.find('[data-test="cta"]');
    expect(ctaEl.attributes('href')).toContain(
      encodeURIComponent('https://app.beamerbridge.com/'),
    );
  });

  it('uses the zebra campaign text when the transfer was subsidized', () => {
    const feeSubAddress = getRandomEthereumAddress();
    const transfer = generateTransfer({
      transferData: generateTransferData({
        requestInformation: generateRequestInformationData({ timestamp: 1 }),
        requestFulfillment: generateRequestFulfillmentData({ timestamp: 100 }),
        sourceChain: generateChain({ feeSubAddress }),
        feeSubAddress,
        fees: generateTokenAmountData({ amount: generateUInt256Data('0') }),
      }),
    });

    const wrapper = shallowMount(ShareTweet, {
      props: {
        transfer,
      },
    });

    const ctaEl = wrapper.find('[data-test="cta"]');
    expect(ctaEl.attributes('href')).toContain(encodeURIComponent('and with 0 fees'));
  });
});
