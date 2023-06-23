interface ImportMetaEnv {
  readonly VITE_CONFIG_URL: string;
  readonly VITE_FAUCET_ENABLED: string;
  readonly VITE_REQUEST_EXPIRY_SECONDS: string;
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
interface ReleaseVariables {
  SEMANTIC_VERSION: string;
  VERSION: string;
  COMMIT_HASH: string;
  REPOSITORY: string;
}

declare const APP_RELEASE: ReleaseVariables;
