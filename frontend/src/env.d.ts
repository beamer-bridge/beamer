interface ImportMetaEnv {
  readonly VITE_CONFIG_URL: string;
  readonly VITE_FAUCET_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
