import { useV1DevicesCreate } from '../../api/generated/composables/useV1DevicesCreate'
import { useAppStore } from '../../store'
import { useV1DevicesPartialUpdate } from '../../api/generated/composables/useV1DevicesPartialUpdate'
import { useDeviceInfoService } from './platform-service'

export const useDevice = () => {
	const accounts = useAppStore(state => state.accounts)
	const deviceID = useAppStore(state => state.deviceID)
	const setDeviceID = useAppStore(state => state.setDeviceID)
	const fcmToken = useAppStore(state => state.fcmToken)
	const deviceInfoService = useDeviceInfoService()

	const { mutateAsync: createDevice } = useV1DevicesCreate()
	const { mutateAsync: updateDevice } = useV1DevicesPartialUpdate()

	return {
		registerDevice: async () => {
			if (!deviceID) {
				const result = await createDevice({
					data: {
						accounts: accounts.map(a => a.address),
						platform: await deviceInfoService.getDevicePlatform(),
						push_token: fcmToken ?? undefined,
						model: deviceInfoService.getDeviceModel(),
						application: 'pera',
					},
				})
				setDeviceID(result.id ?? null)
			} else {
                await updateDevice({
                    device_id: deviceID,
                    data: {
                        accounts: accounts.map(a => a.address),
                        platform: await deviceInfoService.getDevicePlatform(),
                        push_token: fcmToken ?? undefined,
                        model: deviceInfoService.getDeviceModel(),
                    },
                })
            }
		},
	}
}
