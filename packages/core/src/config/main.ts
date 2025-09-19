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
})

export type Config = z.infer<typeof configSchema>

/**
 * Select a validated config object based on the provided env or process env.
 * - APP_ENV has precedence over NODE_ENV
 * - Maps 'test' (Vitest) to staging by default
 * - Fallback for unknown values is staging
 */
export function getConfigForEnv(env?: string): Config {
    const key = (
        env ??
        process.env.APP_ENV ??
        process.env.NODE_ENV ??
        'staging'
    ).toLowerCase()

    let selected: Config
    switch (key) {
        case 'production':
        case 'prod':
            selected = productionConfig
            break
        case 'staging':
        case 'stage':
            selected = stagingConfig
            break
        case 'development':
        case 'dev':
        case 'test': // vitest default
        default:
            selected = developmentConfig
    }

    // Validate the selected config against the schema
    return configSchema.parse(selected)
}

export const config = getConfigForEnv()
Object.freeze(config)
