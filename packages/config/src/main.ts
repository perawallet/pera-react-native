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

import { z } from 'zod'
import { config as developmentConfig } from './development'
import { config as stagingConfig } from './staging'
import { config as productionConfig } from './production'

export const configSchema = z.object({
    mainnetBackendUrl: z.url(),
    testnetBackendUrl: z.url(),
    mainnetAlgodUrl: z.url(),
    testnetAlgodUrl: z.url(),
    mainnetIndexerUrl: z.url(),
    testnetIndexerUrl: z.url(),
    backendAPIKey: z.string(),
    algodApiKey: z.string(),
    indexerApiKey: z.string(),

    notificationRefreshTime: z.int(),
    remoteConfigRefreshTime: z.int(),

    discoverBaseUrl: z.url(),
    stakingBaseUrl: z.url(),

    debugEnabled: z.boolean(),
    profilingEnabled: z.boolean(),
})

export type Config = z.infer<typeof configSchema>

/**
 * Select a validated config object based on the provided env or environment variables.
 * - APP_ENV has precedence over NODE_ENV
 * - Maps 'test' (Vitest) to staging by default
 * - Fallback for unknown values is staging
 */
export function getConfigForEnv(env?: string): Config {
    const key = (env ?? 'staging')?.toLowerCase() || 'staging'

    let selected: Config
    switch (key) {
        case 'production':
        case 'prod':
            console.log('Configured for production')
            selected = productionConfig
            break
        case 'staging':
        case 'stage':
            console.log('Configured for staging')
            selected = stagingConfig
            break
        case 'development':
        case 'dev':
        case 'test': // vitest default
        default:
            console.log('Configured for development')
            selected = developmentConfig
    }

    // Validate the selected config against the schema
    return configSchema.parse(selected)
}

export const config = getConfigForEnv()
Object.freeze(config)
