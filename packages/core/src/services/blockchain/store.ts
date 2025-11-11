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

import type { StateCreator } from 'zustand'
import { Networks, type Network, type SignRequest } from './types'
import { v7 as uuidv7 } from 'uuid'

export type BlockchainSlice = {
    network: Network
    pendingSignRequests: SignRequest[]
    setNetwork: (network: Network) => void
    addSignRequest: (request: SignRequest) => boolean
    removeSignRequest: (request: SignRequest) => boolean
}

export const createBlockchainSlice: StateCreator<
    BlockchainSlice,
    [],
    [],
    BlockchainSlice
> = (set, get) => {
    return {
        network: Networks.mainnet,
        pendingSignRequests: [],
        setNetwork: (network: Network) => {
            //TODO in an ideal world we need to trigger clearing the react-query cache here
            set({ network })
        },
        addSignRequest: (request: SignRequest) => {
            const existing = get().pendingSignRequests ?? []
            const newRequest = {
                ...request,
                id: request.id ?? uuidv7(),
            }
            if (!existing.find(r => r.id === newRequest.id)) {
                set({ pendingSignRequests: [...existing, newRequest] })
                return true
            }
            return false
        },
        removeSignRequest: (request: SignRequest) => {
            const existing = get().pendingSignRequests ?? []
            const remaining = existing.filter(r => r.id !== request.id)

            if (remaining.length != existing.length) {
                set({ pendingSignRequests: remaining })
            }

            return remaining.length != existing.length
        },
    }
}

export const partializeBlockchainSlice = (state: BlockchainSlice) => {
    return {
        network: state.network,
        pendingSignRequests: state.pendingSignRequests,
    }
}
