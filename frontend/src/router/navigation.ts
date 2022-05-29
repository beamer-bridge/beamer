import router from '@/router';

export function switchToRequestDialog() {
  router.replace({ path: '/', query: { activeTabLabel: 'Transfer' } });
}

export function switchToActivities() {
  router.replace({ path: '/', query: { activeTabLabel: 'Activity' } });
}
