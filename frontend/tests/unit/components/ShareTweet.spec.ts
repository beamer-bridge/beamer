import { shallowMount } from '@vue/test-utils';
import { ref } from 'vue';

import ShareTweet from '@/components/ShareTweet.vue';
import {
  generateChain,
  generateRequestFulfillmentData,
  generateRequestInformationData,
  generateSubsidizedTransferData,
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

  it('uses the default text by default', () => {
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
    const defaultText = `I just used @beamerbridge to seamlessly and securely transfer #${transfer.sourceAmount.token.symbol} from ${transfer.sourceChain.name} to ${transfer.targetChain.name} in ${transfer.transferTimeSeconds} seconds! 🔥

Unlock lightning-fast and secure bridging with Beamer today 💪💫  Now also live on Polygon zkEVM!
https://app.beamerbridge.com/`;
    expect(ctaEl.attributes('href')).toContain(encodeURIComponent(defaultText));
  });

  it('uses the zebra campaign text when the transfer was subsidized', () => {
    const feeSubAddress = getRandomEthereumAddress();
    const transfer = generateTransfer({
      transferData: generateSubsidizedTransferData({
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
    const subsidizedTransferText = `Unbelievable! @beamerbridge just unlocked 🦓 - it won't last, so don't miss out! 👀

Sent #${transfer.sourceAmount.token.symbol} from ${transfer.sourceChain.name} to ${transfer.targetChain.name} securely in ${transfer.transferTimeSeconds} seconds using 🦓. You can do it too! 🔥

Get lightning-fast and secure bridging with Beamer now 💪💫
https://app.beamerbridge.com/`;
    expect(ctaEl.attributes('href')).toContain(encodeURIComponent(subsidizedTransferText));
  });
});
