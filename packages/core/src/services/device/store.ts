import type { Network } from '../../services/blockchain'
import type { StateCreator } from 'zustand'

export type DeviceSlice = {
    fcmToken: string | null
    deviceIDs: Map<Network, string>
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
        deviceIDs: new Map(),
        setFcmToken: token => set({ fcmToken: token }),
        setDeviceID: (network, id) => {
            const { deviceIDs } = get()
            if (id) {
                deviceIDs.set(network, id)
            } else {
                deviceIDs.delete(network)
            }
            
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
