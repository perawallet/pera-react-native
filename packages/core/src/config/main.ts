import { z } from 'zod'
import { config as developmentConfig } from './development'
import { config as stagingConfig } from './staging'
import { config as productionConfig } from './production'

export const configSchema = z.object({
	mainnetBackendUrl: z.url(),
	testnetBackendUrl: z.url(),
})

export const environment = 'development'
export type Config = z.infer<typeof configSchema>

function getConfig(): Config {
	if (environment === 'development')
		return developmentConfig
	else if (environment === 'staging')
		return stagingConfig
	else 
		return productionConfig
}

export const config = getConfig()

Object.freeze(config)
