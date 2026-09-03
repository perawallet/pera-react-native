/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { Extension } from '@algorandfoundation/wallet-provider'
import { createConnectionStore } from './store'
import type { ConnectionPersistence, ConnectionStoreAPI } from './models'

export interface ConnectionsExtension {
    connections: { store: ConnectionStoreAPI }
}

/**
 * wallet-provider Extension registering the connection store on the
 * provider. Must be composed AFTER the platform extension — it reads
 * `provider.keyValueStorage` for persistence.
 */
export const WithConnections: Extension<ConnectionsExtension> = (
    provider: Record<string, unknown>,
) => {
    const storage = provider.keyValueStorage as
        | ConnectionPersistence
        | undefined
    if (!storage) {
        throw new Error(
            'WithConnections requires provider.keyValueStorage — compose it after the platform extension',
        )
    }
    const connections = { store: createConnectionStore({ storage }) }
    provider.connections = connections
    return { connections }
}
