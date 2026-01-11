# Pera Wallet Configuration

Centralized, type-safe configuration system for Pera Wallet with environment-specific overrides and build-time injection support.

## Overview

This package provides a Zod-validated configuration system that supports:

- Safe open source defaults (public Algorand nodes, placeholder backend URLs)
- Environment-specific overrides (development, staging, production)
- Build-time injection via environment variables for official builds
- Type safety and runtime validation

## Configuration Loading Order

Configuration values are loaded and merged in this order (later values override earlier ones):

1. **Base production config** (`production.ts`) - Safe OSS defaults
2. **Environment overrides** (`development.ts`, `staging.ts`) - Environment-specific settings
3. **Environment variables** (prefixed with `PERA_`) - Build-time injection for official builds

## Usage

### Basic Import

```typescript
import { config } from '@perawallet/wallet-core-config'

// Use the config
const backendUrl = config.mainnetBackendUrl
const apiKey = config.backendAPIKey
```

### Environment Selection

The environment is selected based on:
- `APP_ENV` environment variable (highest priority)
- `NODE_ENV` environment variable (fallback)
- Defaults to `'development'` if neither is set

Supported environments:
- `development` / `dev` - Development overrides
- `staging` / `stage` - Staging overrides
- `production` / `prod` - Production config (no overrides)
- `test` - Mapped to development (for Vitest)

## Open Source Builds

By default, the configuration uses safe values for open source builds:

- **Algorand Nodes**: Public AlgoNode infrastructure (no authentication required)
    - Mainnet algod: `https://mainnet-api.algonode.cloud`
    - Testnet algod: `https://testnet-api.algonode.cloud`
    - Mainnet indexer: `https://mainnet-idx.algonode.cloud`
    - Testnet indexer: `https://testnet-idx.algonode.cloud`

- **Backend URLs**: Placeholder values
    - Mainnet: `https://api.example.com`
    - Testnet: `https://testnet-api.example.com`
    
- **API Keys**: Empty strings (no authentication)

These defaults allow the app to compile and partially function out of the box. Community builders can provide their own backend infrastructure by setting environment variables (see below).

## Official Builds (Environment Variable Injection)

For official Pera Wallet builds, sensitive values are injected at build time using environment variables:

### Available Environment Variables

All variables are optional and prefixed with `PERA_`:

**Backend Configuration:**
- `PERA_MAINNET_BACKEND_URL` - Mainnet backend API URL
- `PERA_TESTNET_BACKEND_URL` - Testnet backend API URL
- `PERA_BACKEND_API_KEY` - Backend API authentication key

**Algorand Nodes (override public defaults):**
- `PERA_MAINNET_ALGOD_URL` - Custom mainnet algod URL
- `PERA_TESTNET_ALGOD_URL` - Custom testnet algod URL
- `PERA_MAINNET_INDEXER_URL` - Custom mainnet indexer URL
- `PERA_TESTNET_INDEXER_URL` - Custom testnet indexer URL

**Node Authentication:**
- `PERA_ALGOD_API_KEY` - Algod API key (if using custom nodes)
- `PERA_INDEXER_API_KEY` - Indexer API key (if using custom nodes)

**Feature Flags:**
- `PERA_DEBUG_ENABLED` - Enable debug logging (`'true'` or `'false'`)
- `PERA_PROFILING_ENABLED` - Enable React profiling (`'true'` or `'false'`)
- `PERA_POLLING_ENABLED` - Enable background polling (`'true'` or `'false'`)

### Example: Staging Build

```bash
APP_ENV=staging \
PERA_MAINNET_BACKEND_URL=https://mainnet.staging.api.perawallet.app \
PERA_TESTNET_BACKEND_URL=https://testnet.staging.api.perawallet.app \
PERA_BACKEND_API_KEY=staging-api-key-here \
PERA_DEBUG_ENABLED=true \
pnpm build
```

### Example: Production Build

```bash
APP_ENV=production \
PERA_MAINNET_BACKEND_URL=https://mainnet.api.perawallet.app \
PERA_TESTNET_BACKEND_URL=https://testnet.api.perawallet.app \
PERA_BACKEND_API_KEY=production-api-key-here \
pnpm build
```

## Configuration Schema

The configuration is validated using Zod. See `main.ts` for the complete schema definition.

Key configuration sections:
- **Algorand nodes** - Algod and indexer URLs for mainnet/testnet
- **Backend APIs** - Pera backend service URLs
- **API keys** - Authentication keys for services
- **Explorer URLs** - Block explorer links
- **Service URLs** - Discover, staking, onramp, support sites
- **Timing** - Notification refresh, remote config refresh
- **React Query** - Cache and stale time settings
- **Feature flags** - Debug, profiling, polling toggles

## Development

### Testing

Unit tests use Vitest:

```bash
# Run tests from package
pnpm test

# Run with coverage from root
pnpm --filter config test

# Watch mode
pnpm test --watch
```

### Adding New Configuration Values

1. Add the new field to `configSchema` in `main.ts`
2. Add the default value to `productionConfig` in `production.ts`
3. Add environment-specific overrides to `development.ts` or `staging.ts` if needed
4. Add environment variable support to `env-loader.ts` if the value should be injectable
5. Update this README and `.env.example`
6. Add tests to verify the new configuration value

### Conventions

- TypeScript strict mode enabled
- Format with `pnpm format` at root
- Keep modules tree-shakeable
- Avoid side effects in module top-level code
- All config values must pass Zod validation

## Security Considerations

- **Never commit** `.env.staging` or `.env.production` files
- **Never hardcode** production API keys or sensitive URLs in source code
- Use environment variable injection for all sensitive values in official builds
- OSS defaults should not expose production infrastructure
- API keys should be empty strings in default configs
