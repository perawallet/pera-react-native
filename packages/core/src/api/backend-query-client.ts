import ky, { type KyInstance, type KyRequest } from 'ky'
import { config } from '../config/main'
import { Networks } from '../services/blockchain'
import { createFetchClient, logRequest, logResponse } from './query-client'

const clients = new Map<string, KyInstance>()

const setStandardHeaders = (request: KyRequest) => {
    request.headers.set('Content-Type', 'application/json')

    if (config.backendAPIKey?.length) {
        request.headers.set('X-API-Key', config.backendAPIKey)
    }
}

const mainnetClient = ky.create({
    hooks: {
        beforeRequest: [setStandardHeaders, logRequest],
        afterResponse: [logResponse],
    },
    prefixUrl: config.mainnetBackendUrl,
})

const testnetClient = ky.create({
    hooks: {
        beforeRequest: [setStandardHeaders, logRequest],
        afterResponse: [logResponse],
    },
    prefixUrl: config.testnetBackendUrl,
})

clients.set(Networks.mainnet, mainnetClient)
clients.set(Networks.testnet, testnetClient)

export const updateBackendHeaders = (headers: Map<string, string>) => {
    clients.forEach((client, network) => {
        clients.set(
            network,
            client.extend({
                hooks: {
                    beforeRequest: [
                        setStandardHeaders,
                        request => {
                            headers.forEach((v, k) => {
                                request.headers.set(k, v)
                            })
                        },
                        logRequest,
                    ],
                    afterResponse: [logResponse],
                },
            }),
        )
    })
}

export const backendFetchClient = createFetchClient(clients)

export default backendFetchClient
