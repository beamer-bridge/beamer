import type { JSONSchemaType } from 'ajv';

import type { BeamerConfig } from '@/types/config';

import type { BeamerConfigEnvMapping } from './types';

export const configSchema: JSONSchemaType<BeamerConfig> = {
  type: 'object',
  properties: {
    chains: {
      type: 'object',
      patternProperties: {
        '^[0-9]{1,}$': {
          type: 'object',
          properties: {
            identifier: {
              type: 'number',
              minimum: 0,
            },
            explorerUrl: {
              type: 'string',
            },
            rpcUrl: {
              type: 'string',
              format: 'uri',
            },
            internalRpcUrl: {
              type: 'string',
              format: 'uri',
            },
            name: {
              type: 'string',
              minLength: 1,
            },
            imageUrl: {
              type: 'string',
              format: 'uri-reference',
              nullable: true,
            },
            tokens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  symbol: {
                    type: 'string',
                    minLength: 1,
                  },
                  decimals: {
                    type: 'number',
                    minimum: 1,
                    maximum: 18,
                  },
                  imageUrl: {
                    type: 'string',
                    format: 'uri-reference',
                    nullable: true,
                  },
                  address: {
                    type: 'string',
                    minLength: 42,
                    maxLength: 42,
                  },
                  hidden: {
                    type: 'boolean',
                    nullable: true,
                  },
                },
                required: ['symbol', 'decimals', 'address'],
                additionalProperties: true,
              },
            },
            nativeCurrency: {
              type: 'object',
              nullable: true,
              required: ['name', 'symbol', 'decimals'],
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                },
                symbol: {
                  type: 'string',
                  minLength: 1,
                },
                decimals: {
                  type: 'number',
                  minimum: 1,
                  maximum: 18,
                },
              },
            },
            requestManagerAddress: {
              type: 'string',
              minLength: 42,
              maxLength: 42,
            },
            fillManagerAddress: {
              type: 'string',
              minLength: 42,
              maxLength: 42,
            },
            feeSubAddress: {
              type: 'string',
              minLength: 42,
              maxLength: 42,
              nullable: true,
            },
            disabled: {
              type: 'boolean',
              nullable: true,
            },
            disabled_reason: {
              type: 'string',
              nullable: true,
            },
            hidden: {
              type: 'boolean',
              nullable: true,
            },
          },
          required: [
            'identifier',
            'explorerUrl',
            'rpcUrl',
            'name',
            'tokens',
            'requestManagerAddress',
            'fillManagerAddress',
          ],
          additionalProperties: true,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  required: ['chains'],
  additionalProperties: false,
};

export const configMappingSchema: JSONSchemaType<BeamerConfigEnvMapping> = {
  $id: 'BeamerConfigEnvMapping',
  type: 'object',
  properties: {
    development: configSchema,
    staging: configSchema,
    production: configSchema,
  },
  required: ['development', 'staging', 'production'],
  additionalProperties: false,
};
