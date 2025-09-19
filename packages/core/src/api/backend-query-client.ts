import ky, { type KyInstance } from 'ky'
import { config } from '../config/main'
import { Networks } from '../services/blockchain'
import { createFetchClient } from './query-client'

const clients = new Map<string, KyInstance>()

const mainnetClient = ky.create({
    //TODO add a beforeRequest hook here to inject headers
    // hooks: {
    // 	beforeRequest: [
    // 		request => {
    // 			request.headers.set('Content-Type', 'application/json')
    // 		},
    // 	],
    // },
    prefixUrl: config.mainnetBackendUrl,
})
const testnetClient = ky.create({
    //TODO add a beforeRequest hook here to inject headers
    // hooks: {
    // 	beforeRequest: [
    // 		request => {
    // 			request.headers.set('Content-Type', 'application/json')
    // 		},
    // 	],
    // },
    prefixUrl: config.testnetBackendUrl,
})

clients.set(Networks.mainnet, mainnetClient)
clients.set(Networks.testnet, testnetClient)

export const backendFetchClient = createFetchClient(clients)

export default backendFetchClient
