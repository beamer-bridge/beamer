declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VUE_APP_CHAIN_ID: string;
      VUE_APP_REQUEST_MANAGER_ADDRESS: string;
      VUE_APP_ETHERSCAN_TX_URL: string;
    }
  }
}

export {};
