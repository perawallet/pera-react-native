import { Networks, type Network } from '../../services/blockchain/types'
import type { StateCreator } from 'zustand'

// Helper functions for Map serialization
const objectToDeviceIDs = (
    obj: Record<string, string | null> | undefined,
): Map<Network, string | null> => {
    const map = new Map<Network, string | null>([
        [Networks.mainnet, null],
        [Networks.testnet, null],
    ])
    if (obj) {
        for (const [key, value] of Object.entries(obj)) {
            map.set(key as Network, value)
        }
    }
    return map
}

export type DeviceSlice = {
    fcmToken: string | null
    deviceIDs: Map<Network, string | null>
    setFcmToken: (token: string | null) => void
    setDeviceID: (network: Network, id: string | null) => void
}

export const createDeviceSlice: StateCreator<
    DeviceSlice,
    [],
    [],
    DeviceSlice
> = (set, get) => {
    return {
        fcmToken: null,
        deviceIDs: new Map([
            ['mainnet', null],
            ['testnet', null],
        ]),
        setFcmToken: token => set({ fcmToken: token }),
        setDeviceID: (network, id) => {
            const { deviceIDs } = get()
            deviceIDs.set(network, id)

            set({ deviceIDs })
        },
    }
}

export const partializeDeviceSlice = (state: DeviceSlice) => {
    const filteredDeviceIDs: Record<string, string> = {}
    for (const [network, id] of state.deviceIDs) {
        if (id !== null) {
            filteredDeviceIDs[network] = id
        }
    }
    return {
        fcmToken: state.fcmToken,
        deviceIDs: filteredDeviceIDs,
    }
}

// Rehydration function to convert persisted object back to Map
export const rehydrateDeviceSlice = (
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    persistedState: any,
): Partial<DeviceSlice> => {
    if (persistedState) {
        return {
            ...persistedState,
            deviceIDs: objectToDeviceIDs(persistedState.deviceIDs),
        }
    }
    return persistedState
}
