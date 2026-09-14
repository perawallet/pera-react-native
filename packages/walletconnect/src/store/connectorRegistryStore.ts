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

import { create } from 'zustand'
import type WalletConnect from '@perawallet/walletconnect'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'

// Not persisted: `WalletConnect` instances are not serializable and tombstones
// only mean anything within one session lifetime.
type State = {
    connectors: Record<string, WalletConnect>
    tombstones: ReadonlySet<string>
}

type Actions = {
    registerConnector: (clientId: string, connector: WalletConnect) => void
    forgetConnector: (clientId: string) => void
} & BaseStoreState

export type ConnectorRegistryStore = State & Actions

const initialState: State = {
    connectors: {},
    tombstones: new Set(),
}

export const useConnectorRegistryStore = create<ConnectorRegistryStore>(
    set => ({
        ...initialState,
        registerConnector: (clientId, connector) =>
            set(s => {
                const tombstones = new Set(s.tombstones)
                tombstones.delete(clientId)
                return {
                    connectors: { ...s.connectors, [clientId]: connector },
                    tombstones,
                }
            }),
        forgetConnector: clientId =>
            set(s => {
                const connectors = { ...s.connectors }
                delete connectors[clientId]
                const tombstones = new Set(s.tombstones)
                tombstones.add(clientId)
                return { connectors, tombstones }
            }),
        resetState: () =>
            set({
                connectors: {},
                tombstones: new Set(),
            }),
    }),
)
