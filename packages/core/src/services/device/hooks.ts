import { useV1DevicesCreate } from '../../api/generated/backend/hooks/useV1DevicesCreate'
import { useAppStore } from '../../store'
import { useV1DevicesPartialUpdate } from '../../api/generated/backend/hooks/useV1DevicesPartialUpdate'
import { useDeviceInfoService } from './platform-service'


export const useDeviceID = () => {
    const network = useAppStore(state => state.network)
    const deviceIDs = useAppStore(state => state.deviceIDs)
    return deviceIDs?.[network] ?? null
}

export const useDevice = () => {
    const accounts = useAppStore(state => state.accounts)
    const network = useAppStore(state => state.network)
    const deviceID = useDeviceID()
    const setDeviceID = useAppStore(state => state.setDeviceID)
    const fcmToken = useAppStore(state => state.fcmToken)
    const deviceInfoService = useDeviceInfoService()

    const { mutateAsync: createDevice } = useV1DevicesCreate()
    const { mutateAsync: updateDevice } = useV1DevicesPartialUpdate()

    const registerDevice = async () => {
        const addresses: string[] = accounts
            .filter(a => a.address)
            .map(a => a.address)
        if (!deviceID) {
            const result = await createDevice({
                data: {
                    accounts: addresses,
                    platform: await deviceInfoService.getDevicePlatform(),
                    push_token: fcmToken ?? undefined,
                    model: deviceInfoService.getDeviceModel(),
                    application: 'pera',
                    locale: deviceInfoService.getDeviceLocale(),
                },
            })
            setDeviceID(network, result.id ?? null)
        } else {
            await updateDevice({
                device_id: deviceID,
                data: {
                    accounts: addresses,
                    platform: await deviceInfoService.getDevicePlatform(),
                    push_token: fcmToken ?? undefined,
                    model: deviceInfoService.getDeviceModel(),
                    locale: deviceInfoService.getDeviceLocale(),
                },
            })
        }
    }

    return {
        registerDevice,
    }
}
