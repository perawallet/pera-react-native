import type { StateCreator } from 'zustand'

export type DeviceSlice = {
    fcmToken: string | null
    deviceID: string | null //TODO: we need to store different deviceIDs per network (mainnet, testnet, etc)
    setFcmToken: (token: string | null) => void
    setDeviceID: (id: string | null) => void
}

export const createDeviceSlice: StateCreator<
    DeviceSlice,
    [],
    [],
    DeviceSlice
> = set => {
    return {
        fcmToken: null,
        deviceID: null,
        setFcmToken: token => set({ fcmToken: token }),
        setDeviceID: id => set({ deviceID: id }),
    }
}

export const partializeDeviceSlice = (state: DeviceSlice) => {
    return {
        fcmToken: state.fcmToken,
        deviceID: state.deviceID,
    }
}
