import { shallowMount } from '@vue/test-utils';

import Footer from '@/components/Footer.vue';

describe('Footer.vue', () => {
  it('renders a link to the imprint', () => {
    const wrapper = shallowMount(Footer);
    const link = wrapper.find('[data-test="imprint-link"]');
    expect(link.attributes('href')).toBe('https://beamerbridge.com/imprint.html');
  });

  it('renders a link to the ToS', () => {
    const wrapper = shallowMount(Footer);
    const link = wrapper.find('[data-test="tos-link"]');
    expect(link.attributes('href')).toBe('https://beamerbridge.com/terms.html');
  });

  it('renders a link to Github', () => {
    const wrapper = shallowMount(Footer);
    const link = wrapper.find('[data-test="github-link"]');
    expect(link.attributes('href')).toBe('https://github.com/beamer-bridge');
  });

  it('renders a link to Discord', () => {
    const wrapper = shallowMount(Footer);
    const link = wrapper.find('[data-test="discord-link"]');
    expect(link.attributes('href')).toBe('https://discord.gg/beamerbridge');
  });

  it('renders a link to Twitter', () => {
    const wrapper = shallowMount(Footer);
    const link = wrapper.find('[data-test="twitter-link"]');
    expect(link.attributes('href')).toBe('https://twitter.com/BeamerBridge');
  });

  it('renders a link to Medium', () => {
    const wrapper = shallowMount(Footer);
    const link = wrapper.find('[data-test="medium-link"]');
    expect(link.attributes('href')).toBe('https://medium.com/@BeamerBridge');
  });
});
