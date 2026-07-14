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
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import {
    computeHasInternet,
    configureNetInfo,
    handleConnectivityChange,
    cancelPendingConnectivityChange,
    REACHABILITY_URL,
} from '../networkStatus'

/**
 * Hook that initializes network status listeners.
 * Call this once at the app root to set up a NetInfo subscription that tracks
 * connectivity into the network store and TanStack Query's onlineManager.
 * Offline UX is surfaced by the global <OfflineBanner /> (see RootComponent),
 * not a transient toast.
 *
 * @example
 * // In RootComponent
 * useNetworkStatusListener()
 */
export const useNetworkStatusListener = (): void => {
    const reachabilityUrl = useRemoteConfig().getStringValue(
        RemoteConfigKeys.network_reachability_url,
        REACHABILITY_URL,
    )

    // Configure NetInfo's reachability probe from the Remote Config URL (falls
    // back to the baked-in 204 endpoint). Done here rather than at module load
    // because the provider — and thus Remote Config — is only ready inside the
    // React tree.
    useEffect(() => {
        configureNetInfo(reachabilityUrl)
    }, [reachabilityUrl])

    // Subscribe to network status changes. Reachability-aware connectivity is
    // computed and debounced in networkStatus; the store (wired to
    // onlineManager via initNetworkStatus) remains the single source of truth.
    useEffect(() => {
        const netInfoSubscription = NetInfo.addEventListener(
            (state: NetInfoState) => {
                handleConnectivityChange(computeHasInternet(state))
            },
        )
        return () => {
            netInfoSubscription()
            cancelPendingConnectivityChange()
        }
    }, [])
}
