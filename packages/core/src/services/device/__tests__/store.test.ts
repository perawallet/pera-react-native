import { describe, test, expect } from 'vitest'
import {
	createDeviceSlice,
	partializeDeviceSlice,
	type DeviceSlice,
} from '../store'

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
		expect(state.deviceID).toBeNull()

		// set values
		state.setFcmToken('FCM-1')
		expect(state.fcmToken).toBe('FCM-1')

		state.setDeviceID('DEV-1')
		expect(state.deviceID).toBe('DEV-1')

		// clear values
		state.setFcmToken(null)
		state.setDeviceID(null)
		expect(state.fcmToken).toBeNull()
		expect(state.deviceID).toBeNull()
	})

	test('partializeDeviceSlice returns only persisted subset', () => {
		const state: DeviceSlice = {
			fcmToken: 'TOK',
			deviceID: 'ID',
			setFcmToken: () => {},
			setDeviceID: () => {},
		}

		const partial = partializeDeviceSlice(state)
		expect(partial).toEqual({
			fcmToken: 'TOK',
			deviceID: 'ID',
		})

		// ensure functions are not included
		expect((partial as any).setFcmToken).toBeUndefined()
		expect((partial as any).setDeviceID).toBeUndefined()
	})
})
