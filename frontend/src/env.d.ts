interface ImportMetaEnv {
  readonly VITE_CONFIG_URL: string;
  readonly VITE_FAUCET_ENABLED: string;
  readonly VITE_REQUEST_EXPIRY_SECONDS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
interface ReleaseVariables {
  VERSION: string;
  COMMIT_HASH: string;
  REPOSITORY: string;
}

declare const APP_RELEASE: ReleaseVariables;
