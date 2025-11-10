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
