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

import { create } from 'zustand'
import type { LiquidAuthSignalClient } from '@perawallet/wallet-extension-liquid-auth'
import type { LiquidAuthRegistryStore } from '../models'

const initialState = {
    clients: {} as Record<string, LiquidAuthSignalClient>,
}

export const useLiquidAuthRegistryStore = create<LiquidAuthRegistryStore>(
    set => ({
        ...initialState,
        registerClient: (sessionId, client) =>
            set(s => ({ clients: { ...s.clients, [sessionId]: client } })),
        forgetClient: sessionId =>
            set(s => {
                const clients = { ...s.clients }
                delete clients[sessionId]
                return { clients }
            }),
        resetState: () => set({ clients: {} }),
    }),
)
