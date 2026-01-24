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

import { type Config, configSchema, overrideEnvironmentMap } from './main'

/**
 * Loads environment variable overrides for the configuration.
 *
 * The environment variables to read each type from are defined in overrideEnvironmentMap.
 *
 * @returns Partial config with environment variable overrides
 */

type OverridesType = Partial<Config> & {
    [key: string]: string | number | string[]
}
export function loadEnvOverrides(): OverridesType {
    const overrides: OverridesType = {}

    Object.entries(overrideEnvironmentMap).forEach(([key, value]) => {
        const envValue = process.env[value]
        if (envValue && key) {
            if (
                key === 'debugEnabled' ||
                key === 'profilingEnabled' ||
                key === 'pollingEnabled'
            ) {
                overrides[key] = envValue === 'true'
            } else {
                overrides[key] = envValue
            }
        }
    })

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
