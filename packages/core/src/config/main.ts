import { z } from 'zod'
import { config as developmentConfig } from './development'

export const configSchema = z.object({
	mainnetBackendUrl: z.url(),
	testnetBackendUrl: z.url(),
})

export type Config = z.infer<typeof configSchema>

function getConfig(): Config {
	//TODO conditionally load a different config file as needed
	return developmentConfig
}

export const config = getConfig()

Object.freeze(config)
