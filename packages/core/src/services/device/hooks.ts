/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useV1DevicesCreate } from '../../api/generated/backend/hooks/useV1DevicesCreate'
import { useAppStore } from '../../store'
import { useV1DevicesPartialUpdate } from '../../api/generated/backend/hooks/useV1DevicesPartialUpdate'
import { useDeviceInfoService } from './platform-service'

export const useDeviceID = () => {
    const network = useAppStore(state => state.network)
    const deviceIDs = useAppStore(state => state.deviceIDs)
    return deviceIDs?.get(network) ?? null
}

export const useFcmToken = () => {
    const { fcmToken, setFcmToken } = useAppStore()
    return {
        fcmToken,
        setFcmToken,
    }
}

export const useDevice = () => {
    const accounts = useAppStore(state => state.accounts)
    const network = useAppStore(state => state.network)
    const deviceIDs = useAppStore(state => state.deviceIDs)
    const deviceID = useDeviceID()
    const { fcmToken, setFcmToken } = useAppStore()
    const setDeviceID = useAppStore(state => state.setDeviceID)
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
        deviceIDs,
        setDeviceID,
        registerDevice,
    }
}
