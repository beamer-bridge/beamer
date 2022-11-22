interface ImportMetaEnv {
  readonly VITE_CONFIG_URL: string;
  readonly VITE_FAUCET_ENABLED: string;
  readonly VITE_REQUEST_EXPIRY_SECONDS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const APP_VERSION: string;
