import ky, { type KyInstance } from 'ky'
import { config } from '@perawallet/config'
import { createFetchClient, logRequest, logResponse } from './query-client'

const clients = new Map<'testnet' | 'mainnet', KyInstance>()

const mainnetClient = ky.create({
    hooks: {
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.algodApiKey?.length) {
                    request.headers.set('X-Algo-API-Token', config.algodApiKey)
                }
            },
            logRequest,
        ],
        afterResponse: [logResponse],
    },
    prefixUrl: config.mainnetAlgodUrl,
})
const testnetClient = ky.create({
    hooks: {
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.algodApiKey?.length) {
                    request.headers.set('X-Algo-API-Token', config.algodApiKey)
                }
            },
            logRequest,
        ],
        afterResponse: [logResponse],
    },
    prefixUrl: config.testnetAlgodUrl,
})

clients.set('mainnet', mainnetClient)
clients.set('testnet', testnetClient)

export const algodFetchClient = createFetchClient(clients)

export default algodFetchClient
