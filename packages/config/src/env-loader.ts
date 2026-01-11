/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { type Config, configSchema } from './main'

/**
 * Loads environment variable overrides for the configuration.
 *
 * This function checks for environment variables prefixed with PERA_
 * and uses them to override the base configuration. This allows
 * build-time injection of sensitive values for production builds
 * while keeping safe defaults for open source builds.
 *
 * Environment variable mapping:
 * - PERA_MAINNET_BACKEND_URL -> mainnetBackendUrl
 * - PERA_TESTNET_BACKEND_URL -> testnetBackendUrl
 * - PERA_BACKEND_API_KEY -> backendAPIKey
 * - PERA_ALGOD_API_KEY -> algodApiKey
 * - PERA_INDEXER_API_KEY -> indexerApiKey
 * - PERA_MAINNET_ALGOD_URL -> mainnetAlgodUrl
 * - PERA_TESTNET_ALGOD_URL -> testnetAlgodUrl
 * - PERA_MAINNET_INDEXER_URL -> mainnetIndexerUrl
 * - PERA_TESTNET_INDEXER_URL -> testnetIndexerUrl
 * - PERA_DEBUG_ENABLED -> debugEnabled (parse as boolean)
 * - PERA_PROFILING_ENABLED -> profilingEnabled (parse as boolean)
 * - PERA_POLLING_ENABLED -> pollingEnabled (parse as boolean)
 *
 * @returns Partial config with environment variable overrides
 */
export function loadEnvOverrides(): Partial<Config> {
    const overrides: Partial<Config> = {}

    // Backend URLs
    if (process.env.PERA_MAINNET_BACKEND_URL) {
        overrides.mainnetBackendUrl = process.env.PERA_MAINNET_BACKEND_URL
    }
    if (process.env.PERA_TESTNET_BACKEND_URL) {
        overrides.testnetBackendUrl = process.env.PERA_TESTNET_BACKEND_URL
    }

    // API Keys
    if (process.env.PERA_BACKEND_API_KEY) {
        overrides.backendAPIKey = process.env.PERA_BACKEND_API_KEY
    }
    if (process.env.PERA_ALGOD_API_KEY) {
        overrides.algodApiKey = process.env.PERA_ALGOD_API_KEY
    }
    if (process.env.PERA_INDEXER_API_KEY) {
        overrides.indexerApiKey = process.env.PERA_INDEXER_API_KEY
    }

    // Algorand node URLs (in case custom nodes are needed)
    if (process.env.PERA_MAINNET_ALGOD_URL) {
        overrides.mainnetAlgodUrl = process.env.PERA_MAINNET_ALGOD_URL
    }
    if (process.env.PERA_TESTNET_ALGOD_URL) {
        overrides.testnetAlgodUrl = process.env.PERA_TESTNET_ALGOD_URL
    }
    if (process.env.PERA_MAINNET_INDEXER_URL) {
        overrides.mainnetIndexerUrl = process.env.PERA_MAINNET_INDEXER_URL
    }
    if (process.env.PERA_TESTNET_INDEXER_URL) {
        overrides.testnetIndexerUrl = process.env.PERA_TESTNET_INDEXER_URL
    }

    // Feature flags (parse as booleans)
    if (process.env.PERA_DEBUG_ENABLED !== undefined) {
        overrides.debugEnabled = process.env.PERA_DEBUG_ENABLED === 'true'
    }
    if (process.env.PERA_PROFILING_ENABLED !== undefined) {
        overrides.profilingEnabled =
            process.env.PERA_PROFILING_ENABLED === 'true'
    }
    if (process.env.PERA_POLLING_ENABLED !== undefined) {
        overrides.pollingEnabled = process.env.PERA_POLLING_ENABLED === 'true'
    }

    return overrides
}

/**
 * Merges base config with environment variable overrides and validates.
 *
 * This is the main entry point for loading configuration with env var support.
 * It takes a base config, applies environment variable overrides, and validates
 * the result against the Zod schema.
 *
 * @param baseConfig - The base configuration to start with
 * @returns Validated and merged configuration
 * @throws If the merged configuration fails schema validation
 */
export function getConfigWithEnvOverrides(baseConfig: Config): Config {
    const envOverrides = loadEnvOverrides()
    const mergedConfig = { ...baseConfig, ...envOverrides }

    // Validate the merged config against the schema
    try {
        return configSchema.parse(mergedConfig)
    } catch (error) {
        console.error(
            'Configuration validation failed with env overrides:',
            error,
        )
        throw new Error(
            'Invalid configuration after applying environment variables',
        )
    }
}
