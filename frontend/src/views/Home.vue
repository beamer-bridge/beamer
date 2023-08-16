<template>
  <div class="home flex justify-center">
    <div
      class="flex w-[22rem] flex-col sm:w-[25rem] md:w-[27rem] lg:w-[27rem] xl:items-center xl:justify-center"
    >
      <WalletConnectionDetails></WalletConnectionDetails>

      <div class="relative mb-7 mt-3 h-[37.3rem] w-full md:h-[40.2rem]">
        <WalletMenu v-if="walletMenuIsOpen" class="absolute z-10" @close="closeWalletMenu" />
        <Tabs
          class="tooltip-reference-element"
          :tabs="tabs"
          :class="tabsClasses"
          :active-tab-label="activeTabLabel"
          @tab-changed="onTabChanged"
        />
      </div>
      <div
        v-show="actionButtonPortalVisible"
        id="action-button-portal"
        class="flex justify-center gap-5"
      >
        <ActionButton v-if="!signer" class="bg-orange" @click="openWalletMenu"
          >Connect to Wallet
        </ActionButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, markRaw, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ActionButton from '@/components/layout/ActionButton.vue';
import Tabs from '@/components/layout/Tabs.vue';
import RequestDialog from '@/components/RequestDialog.vue';
import TransferHistory from '@/components/TransferHistory.vue';
import WalletConnectionDetails from '@/components/WalletConnectionDetails.vue';
import WalletMenu from '@/components/WalletMenu.vue';
import { useWallet } from '@/composables/useWallet';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumWallet } from '@/stores/ethereum-wallet';
import { usePortals } from '@/stores/portals';
import { useSettings } from '@/stores/settings';

const configuration = useConfiguration();
const ethereumProvider = useEthereumWallet();
const { signer } = storeToRefs(ethereumProvider);
const { actionButtonPortalVisible } = storeToRefs(usePortals());
const { hideActionButton, showActionButton } = usePortals();
const walletMenuIsOpen = ref(false);

function openWalletMenu(): void {
  walletMenuIsOpen.value = true;
  hideActionButton();
}

function closeWalletMenu(): void {
  walletMenuIsOpen.value = false;
  showActionButton();
}

const tabs = [
  { label: 'Transfer', content: markRaw(RequestDialog) },
  { label: 'Activity', content: markRaw(TransferHistory) },
];

/*
 * Please note that we must apply the blur effect on the background element,
 * because the backdrop blur property is not yet fully supported by all
 * web-browsers. As this UI doesn't work without the effect, we need to ensure it
 * always works. This is the current workaround in contrast to having a blurred
 * backdrop on the WalletMenu component itself.
 */
const tabsClasses = computed(() => ({
  'blur-xl': walletMenuIsOpen.value,
}));

const route = useRoute();
const router = useRouter();
const activeTabLabel = ref(tabs[0].label);

function onTabChanged(newActiveTabLabel: string): void {
  activeTabLabel.value = newActiveTabLabel;
}

watch(
  () => route.query?.activeTabLabel,
  () => (activeTabLabel.value = route.query.activeTabLabel as string),
  { immediate: true },
);

watch(
  activeTabLabel,
  () => {
    router.replace({ path: route.path, query: { activeTabLabel: activeTabLabel.value } });
  },
  { immediate: true },
);

const { provider } = storeToRefs(ethereumProvider);
const { rpcUrls } = storeToRefs(configuration);
const { connectedWallet } = storeToRefs(useSettings());
const { autoconnectToWallet } = useWallet(provider, connectedWallet, rpcUrls);

onMounted(autoconnectToWallet);
</script>

<style>
#action-button-portal > *:not(:first-child) {
  display: none;
}
</style>
