import useLoadConfiguration from '@/composables/useLoadConfiguration';
import { generateBeamerConfig } from '~/utils/data_generators';

describe('useLoadConfiguration', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ json: vi.fn() });
  });

  describe('configurationLoaded', () => {
    it('is true when app configuration was loaded successfully', async () => {
      const { configurationLoaded, loadConfiguration } = useLoadConfiguration(vi.fn());

      expect(configurationLoaded.value).toBe(false);

      await loadConfiguration();

      expect(configurationLoaded.value).toBe(true);
    });
    it('is false when app configuration cannot be loaded', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        throw new Error('failed loading');
      });

      const { configurationLoaded, loadConfiguration } = useLoadConfiguration(vi.fn());

      expect(configurationLoaded.value).toBe(false);

      await loadConfiguration();

      expect(configurationLoaded.value).toBe(false);
    });
  });

  it('provides an executable function that loads the app configuration', async () => {
    const appConfig = generateBeamerConfig();
    global.fetch = vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue(appConfig) });

    const setConfiguration = vi.fn();
    const { loadConfiguration } = useLoadConfiguration(setConfiguration);

    await loadConfiguration();

    expect(setConfiguration).toHaveBeenCalledWith(appConfig);
  });
});
