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

import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native'

type UseBlePermissionsResult = {
    hasPermissions: boolean
    isChecking: boolean
    /**
     * True after a request resolves with `NEVER_ASK_AGAIN` for any of the
     * required permissions. In this state the system will not show another
     * permission dialog — the user must change the setting from the OS
     * settings screen.
     */
    isBlocked: boolean
    requestPermissions: () => Promise<boolean>
    openSettings: () => Promise<void>
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
    const [isBlocked, setIsBlocked] = useState(false)

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

    const refresh = useCallback(async () => {
        if (Platform.OS === 'ios') return
        try {
            const granted = await checkAndroidPermissions()
            setHasPermissions(granted)
            if (granted) setIsBlocked(false)
        } finally {
            setIsChecking(false)
        }
    }, [checkAndroidPermissions])

    useEffect(() => {
        refresh()
    }, [refresh])

    // Re-check when the app comes back to the foreground so that a user who
    // changed the setting from system Settings sees the permission state
    // update automatically instead of having to tap a retry button first.
    useEffect(() => {
        if (Platform.OS === 'ios') return
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') refresh()
        })
        return () => subscription.remove()
    }, [refresh])

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === 'ios') return true

        const apiLevel = Number(Platform.Version)

        if (apiLevel >= 31) {
            const requiredPermissions = [
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]
            const results =
                await PermissionsAndroid.requestMultiple(requiredPermissions)

            const granted = requiredPermissions.every(
                p => results[p] === PermissionsAndroid.RESULTS.GRANTED,
            )
            const blocked =
                !granted &&
                requiredPermissions.some(
                    p =>
                        results[p] ===
                        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
                )

            setHasPermissions(granted)
            setIsBlocked(blocked)
            return granted
        }

        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        )
        const granted = result === PermissionsAndroid.RESULTS.GRANTED
        const blocked =
            !granted && result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        setHasPermissions(granted)
        setIsBlocked(blocked)
        return granted
    }, [])

    const openSettings = useCallback(async () => {
        await Linking.openSettings()
    }, [])

    return {
        hasPermissions,
        isChecking,
        isBlocked,
        requestPermissions,
        openSettings,
    }
}
