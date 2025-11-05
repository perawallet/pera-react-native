import type { Network } from '../../services/blockchain'
import type { StateCreator } from 'zustand'

export type DeviceSlice = {
    fcmToken: string | null
    deviceIDs: Record<Network, string|null>
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
        deviceIDs: {
            mainnet: null,
            testnet: null
        },
        setFcmToken: token => set({ fcmToken: token }),
        setDeviceID: (network, id) => {
            const { deviceIDs } = get()
            deviceIDs[network] = id
            
            set({ deviceIDs })
        }
    }
}

export const partializeDeviceSlice = (state: DeviceSlice) => {
    return {
        fcmToken: state.fcmToken,
        deviceIDs: state.deviceIDs,
    }
}
