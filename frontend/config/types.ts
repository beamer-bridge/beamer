import type { BeamerConfig } from '@/types/config';

export type Environment = 'development' | 'staging' | 'production';
export type BeamerConfigEnvMapping = Record<Environment, BeamerConfig>;
