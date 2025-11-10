import { describe, test, expect } from 'vitest'
import {
    createDeviceSlice,
    partializeDeviceSlice,
    rehydrateDeviceSlice,
    type DeviceSlice,
} from '../store'
import { Networks } from '../../../services/blockchain/types'

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
        expect(state.deviceIDs).toEqual(
            new Map([
                ['mainnet', null],
                ['testnet', null],
            ]),
        )

        // set values
        state.setFcmToken('FCM-1')
        expect(state.fcmToken).toBe('FCM-1')

        state.setDeviceID(Networks.testnet, 'DEV-1')
        expect(state.deviceIDs.get(Networks.testnet)).toBe('DEV-1')
        expect(state.deviceIDs.get(Networks.mainnet)).toBeNull()

        // clear values
        state.setFcmToken(null)
        state.setDeviceID(Networks.testnet, null)
        expect(state.fcmToken).toBeNull()
        expect(state.deviceIDs.get(Networks.testnet)).toBeNull()
    })

    test('partializeDeviceSlice returns only persisted subset', () => {
        const state: DeviceSlice = {
            fcmToken: 'TOK',
            deviceIDs: new Map([
                [Networks.testnet, 'ID'],
                [Networks.mainnet, null],
            ]),
            setFcmToken: () => {},
            setDeviceID: () => {},
        }

        const partial = partializeDeviceSlice(state)
        expect(partial).toEqual({
            fcmToken: 'TOK',
            deviceIDs: { testnet: 'ID' },
        })

        // ensure functions are not included
        expect((partial as any).setFcmToken).toBeUndefined()
        expect((partial as any).setDeviceID).toBeUndefined()
    })

    test('rehydrateDeviceSlice converts persisted object back to Map', () => {
        const persistedState = {
            fcmToken: 'PERSISTED_TOKEN',
            deviceIDs: {
                testnet: 'PERSISTED_ID',
                mainnet: null,
            },
            // Other unrelated state
            someOtherProperty: 'value',
        }

        const rehydrated = rehydrateDeviceSlice(persistedState)

        expect(rehydrated.fcmToken).toBe('PERSISTED_TOKEN')
        expect(rehydrated.deviceIDs).toBeInstanceOf(Map)
        expect(rehydrated.deviceIDs!.get('testnet')).toBe('PERSISTED_ID')
        expect(rehydrated.deviceIDs!.get('mainnet')).toBe(null)
        // Should have default null for missing networks
        expect(rehydrated.deviceIDs!.has('mainnet')).toBe(true)
        expect(rehydrated.deviceIDs!.has('testnet')).toBe(true)
    })

    test('rehydrateDeviceSlice handles undefined deviceIDs', () => {
        const persistedState = {
            fcmToken: 'TOKEN',
            // deviceIDs is undefined
        }

        const rehydrated = rehydrateDeviceSlice(persistedState)

        expect(rehydrated.fcmToken).toBe('TOKEN')
        expect(rehydrated.deviceIDs).toBeInstanceOf(Map)
        expect(rehydrated.deviceIDs!.get('mainnet')).toBe(null)
        expect(rehydrated.deviceIDs!.get('testnet')).toBe(null)
    })

    test('rehydrateDeviceSlice handles empty persisted state', () => {
        const persistedState = {}

        const rehydrated = rehydrateDeviceSlice(persistedState)

        expect(rehydrated.deviceIDs).toBeInstanceOf(Map)
        expect(rehydrated.deviceIDs!.get('mainnet')).toBe(null)
        expect(rehydrated.deviceIDs!.get('testnet')).toBe(null)
    })
})
