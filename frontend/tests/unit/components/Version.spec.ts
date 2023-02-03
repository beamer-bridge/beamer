import { mount } from '@vue/test-utils';

import Version from '@/components/Version.vue';

const envCopy = Object.assign({}, APP_RELEASE);

const resetEnvMock = () => {
  Object.assign(APP_RELEASE, envCopy);
};

describe('Version.vue', () => {
  afterEach(() => {
    resetEnvMock();
  });

  it('is hidden when no version is defined', () => {
    Object.assign(APP_RELEASE, { COMMIT_HASH: undefined });

    const wrapper = mount(Version);

    const commitHashEl = wrapper.find('[data-test="commit-hash"]');
    expect(commitHashEl.exists()).toBe(false);
  });
  it('displays the commit hash of the build', () => {
    const wrapper = mount(Version);

    const commitHashEl = wrapper.find('[data-test="commit-hash"]');
    expect(commitHashEl.text()).toBe(APP_RELEASE.COMMIT_HASH);
  });
});
