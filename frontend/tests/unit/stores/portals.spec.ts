import { createPinia, setActivePinia } from 'pinia';

import { usePortals } from '@/stores/portals';

describe('portals store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('state', () => {
    it('keeps track of action button portal visibility', () => {
      const { actionButtonPortalVisible } = usePortals();
      expect(actionButtonPortalVisible).toBe(true);
    });
  });

  describe('actions', () => {
    it('allows hiding action button portal', () => {
      const portals = usePortals();
      portals.hideActionButton();
      expect(portals.actionButtonPortalVisible).toBe(false);
    });

    it('allows showing action button portal', () => {
      const portals = usePortals();
      portals.showActionButton();
      expect(portals.actionButtonPortalVisible).toBe(true);
    });
  });
});
