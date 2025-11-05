import { describe, test, expect } from 'vitest'
import {
    createDeviceSlice,
    partializeDeviceSlice,
    type DeviceSlice,
} from '../store'
import { Networks } from '../../../services/blockchain'

describe('services/device/store', () => {
    test('defaults to nulls and setters update state', () => {
        let state: DeviceSlice

        const set = (partial: Partial<DeviceSlice>) => {
            state = {
                ...(state as DeviceSlice),
                ...(partial as DeviceSlice),
            }
        }
        const get = () => state

        // initialize slice
        state = createDeviceSlice(set as any, get as any, {} as any)

        // defaults
        expect(state.fcmToken).toBeNull()
        expect(state.deviceIDs).toEqual(new Map())

        // set values
        state.setFcmToken('FCM-1')
        expect(state.fcmToken).toBe('FCM-1')

        state.setDeviceID(Networks.testnet, 'DEV-1')
        expect(state.deviceIDs[Networks.testnet]).toBe('DEV-1')
        expect(state.deviceIDs[Networks.mainnet]).toBeUndefined()

        // clear values
        state.setFcmToken(null)
        state.setDeviceID(Networks.testnet, null)
        expect(state.fcmToken).toBeNull()
        expect(state.deviceIDs[Networks.testnet]).toBeUndefined()
    })

    test('partializeDeviceSlice returns only persisted subset', () => {
        const state: DeviceSlice = {
            fcmToken: 'TOK',
            deviceIDs: {
                testnet: 'ID',
                mainnet: null
            },
            setFcmToken: () => {},
            setDeviceID: () => {},
        }

        const partial = partializeDeviceSlice(state)
        expect(partial).toEqual({
            fcmToken: 'TOK',
            deviceIDs: new Map([[Networks.testnet, 'ID']]),
        })

        // ensure functions are not included
        expect((partial as any).setFcmToken).toBeUndefined()
        expect((partial as any).setDeviceID).toBeUndefined()
    })
})
