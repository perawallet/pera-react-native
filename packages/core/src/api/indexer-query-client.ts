import ky, { type KyInstance } from 'ky'
import { config } from '@perawallet/config'
import { createFetchClient, logRequest, logResponse } from './query-client'

const clients = new Map<"testnet" | "mainnet", KyInstance>()

const mainnetClient = ky.create({
    hooks: {
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.indexerApiKey?.length) {
                    request.headers.set(
                        'X-Indexer-API-Token',
                        config.indexerApiKey,
                    )
                }
            },
        ],
    },
    prefixUrl: config.mainnetIndexerUrl,
})
const testnetClient = ky.create({
    hooks: {
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.indexerApiKey?.length) {
                    request.headers.set(
                        'X-Indexer-API-Token',
                        config.indexerApiKey,
                    )
                }
            },
            logRequest,
        ],
        afterResponse: [logResponse],
    },
    prefixUrl: config.testnetIndexerUrl,
})

clients.set("mainnet", mainnetClient)
clients.set("testnet", testnetClient)

export const indexerFetchClient = createFetchClient(clients)

export default indexerFetchClient
