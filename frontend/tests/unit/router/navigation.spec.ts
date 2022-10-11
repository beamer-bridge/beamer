import * as router from '@/router';
import { switchToActivities, switchToRequestDialog } from '@/router/navigation';

vi.mock('@/router', () => ({
  default: {
    replace: vi.fn(),
  },
}));

describe('navigation', () => {
  describe('switchToRequestDialog()', () => {
    it('navigates to the request input form', () => {
      switchToRequestDialog();

      expect(router.default.replace).toHaveBeenNthCalledWith(1, {
        path: '/',
        query: { activeTabLabel: 'Transfer' },
      });
    });
  });

  describe('switchToActivities()', () => {
    it('navigates to the activity history', () => {
      switchToActivities();

      expect(router.default.replace).toHaveBeenNthCalledWith(1, {
        path: '/',
        query: { activeTabLabel: 'Activity' },
      });
    });
  });
});
