import { mount } from '@vue/test-utils';

import Version from '@/components/Version.vue';

const globalCopy = Object.assign({}, APP_RELEASE);
const importEnvCopy = Object.assign({}, import.meta.env);

const resetImportEnv = (): void => {
  Object.assign(import.meta.env, importEnvCopy);
};

const resetGlobalVariables = (): void => {
  Object.assign(APP_RELEASE, globalCopy);
};

describe('Version.vue', () => {
  afterEach(() => {
    resetImportEnv();
    resetGlobalVariables();
  });

  it('is hidden when in development mode', () => {
    Object.assign(import.meta.env, {
      MODE: 'development',
    });
    const wrapper = mount(Version);

    const commitHashEl = wrapper.find('[data-test="version"]');
    expect(commitHashEl.exists()).toBe(false);
  });

  it('is visible when in production mode', () => {
    Object.assign(import.meta.env, {
      MODE: 'production',
    });

    const wrapper = mount(Version);

    const commitHashEl = wrapper.find('[data-test="version"]');
    expect(commitHashEl.exists()).toBe(true);
  });

  it('is hidden when commit hash is undefined', () => {
    Object.assign(APP_RELEASE, { COMMIT_HASH: undefined });

    const wrapper = mount(Version);

    const commitHashEl = wrapper.find('[data-test="version"]');
    expect(commitHashEl.exists()).toBe(false);
  });

  it('displays the release version of the build', () => {
    const wrapper = mount(Version);

    const commitHashEl = wrapper.find('[data-test="version"]');
    expect(commitHashEl.text()).toBe(APP_RELEASE.VERSION);
  });
});
