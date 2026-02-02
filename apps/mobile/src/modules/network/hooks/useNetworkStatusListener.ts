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

import { useEffect } from 'react'
import { AppState } from 'react-native'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { useToast } from '@hooks/useToast'
import { LONG_NOTIFICATION_DURATION } from '@constants/ui'
import { useNetworkStatusStore } from './useNetworkStatusStore'

/**
 * Hook that initializes network status listeners.
 * Call this once at the app root to set up:
 * - NetInfo subscription to track connectivity
 * - Toast notifications for offline status
 *
 * @example
 * // In RootComponent
 * useNetworkStatusListener()
 */
export const useNetworkStatusListener = (): void => {
    const { showToast } = useToast()
    const setHasInternet = useNetworkStatusStore(state => state.setHasInternet)
    const hasInternet = useNetworkStatusStore(state => state.hasInternet)

    // Subscribe to network status changes
    useEffect(() => {
        const netInfoSubscription = NetInfo.addEventListener(
            (state: NetInfoState) => {
                const isConnected = state.isConnected !== false
                setHasInternet(isConnected)
                onlineManager.setOnline(isConnected)
            },
        )
        return () => {
            netInfoSubscription()
        }
    }, [setHasInternet])

    // Show toast when going offline
    useEffect(() => {
        if (!hasInternet && AppState.currentState === 'active') {
            showToast(
                {
                    title: 'No Internet Connection',
                    body: 'Some data may not be up to date.',
                    type: 'warning',
                },
                { duration: LONG_NOTIFICATION_DURATION },
            )
        }
    }, [hasInternet, showToast])
}
