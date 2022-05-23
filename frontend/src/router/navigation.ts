import router from '@/router';

export function switchToActivities() {
  router.replace({ path: '/', query: { activeTabLabel: 'Activity' } });
}
