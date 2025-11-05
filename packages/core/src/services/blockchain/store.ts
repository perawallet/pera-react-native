import type { StateCreator } from 'zustand'
import { Networks, type Network } from './types'

export type BlockchainSlice = {
    network: Network
    setNetwork: (network: Network) => void
}

export const createBlockchainSlice: StateCreator<
    BlockchainSlice,
    [],
    [],
    BlockchainSlice
> = set => {
    return {
        network: Networks.mainnet,
        setNetwork: (network: Network) => {
            //TODO in an ideal world we need to trigger clearing the react-query cache here
            set({ network })
        },
    }
}

export const partializeBlockchainSlice = (state: BlockchainSlice) => {
    return {
        network: state.network,
    }
}
