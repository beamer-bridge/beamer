declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VUE_APP_CONFIG_URL: string;
    }
  }
}

export {};
