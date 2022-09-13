import { defineStore } from 'pinia';

export const usePortals = defineStore('portals', {
  state: () => ({
    actionButtonPortalVisible: true,
  }),
  actions: {
    showActionButton() {
      this.actionButtonPortalVisible = true;
    },
    hideActionButton() {
      this.actionButtonPortalVisible = false;
    },
  },
});
