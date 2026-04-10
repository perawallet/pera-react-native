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

import { useCallback, useState, useEffect } from 'react'
import { Platform, PermissionsAndroid } from 'react-native'

type UseBlePermissionsResult = {
    hasPermissions: boolean
    isChecking: boolean
    requestPermissions: () => Promise<boolean>
}

/**
 * Hook that manages BLE (Bluetooth Low Energy) permissions for Ledger device communication.
 *
 * - iOS: Bluetooth permission is handled by the system automatically when BLE scanning begins.
 * - Android 12+ (API 31+): Requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT runtime permissions.
 * - Android < 12: Requires ACCESS_FINE_LOCATION for BLE scanning.
 */
export const useBlePermissions = (): UseBlePermissionsResult => {
    const [hasPermissions, setHasPermissions] = useState(Platform.OS === 'ios')
    const [isChecking, setIsChecking] = useState(Platform.OS !== 'ios')

    const checkAndroidPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true

        const apiLevel = Number(Platform.Version)

        if (apiLevel >= 31) {
            const scanGranted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            )
            const connectGranted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            )
            return scanGranted && connectGranted
        }

        return PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        )
    }, [])

    useEffect(() => {
        if (Platform.OS === 'ios') return

        checkAndroidPermissions()
            .then(granted => {
                setHasPermissions(granted)
                setIsChecking(false)
            })
            .catch(() => {
                setIsChecking(false)
            })
    }, [checkAndroidPermissions])

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === 'ios') return true

        const apiLevel = Number(Platform.Version)

        if (apiLevel >= 31) {
            const results = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ])

            const granted =
                results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
                    PermissionsAndroid.RESULTS.GRANTED &&
                results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
                    PermissionsAndroid.RESULTS.GRANTED

            setHasPermissions(granted)
            return granted
        }

        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        )
        const granted = result === PermissionsAndroid.RESULTS.GRANTED
        setHasPermissions(granted)
        return granted
    }, [])

    return {
        hasPermissions,
        isChecking,
        requestPermissions,
    }
}
