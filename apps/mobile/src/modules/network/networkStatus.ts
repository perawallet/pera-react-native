/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { useNetworkStatusStore } from './hooks/useNetworkStatusStore'

/**
 * Must return HTTP 204 with an empty body. iOS has no native reachability
 * signal, so without an explicit probe URL `isInternetReachable` never turns
 * `false` on a captive portal or dead gateway.
 *
 * TODO(PERA-4570): swap for a Pera-controlled 204 endpoint once ops hosts it.
 */
export const REACHABILITY_URL = 'https://clients3.google.com/generate_204'

/**
 * Trailing debounce on going-offline only, so airplane-mode flapping collapses
 * to one transition per window. Going online applies immediately.
 */
export const OFFLINE_DEBOUNCE_MS = 2000

let offlineTimer: ReturnType<typeof setTimeout> | null = null

/**
 * The boot seed's `fetch()` can resolve seconds later (active probing), by
 * which point the listener may have committed fresher state that the stale
 * boot result must not clobber.
 */
let liveSignalSinceBoot = false

const clearOfflineTimer = (): void => {
    if (offlineTimer !== null) {
        clearTimeout(offlineTimer)
        offlineTimer = null
    }
}

/**
 * The one place connectivity is mutated — the store is the single source of
 * truth and the only writer to TanStack Query's `onlineManager`.
 */
const applyConnectivity = (hasInternet: boolean): void => {
    if (useNetworkStatusStore.getState().hasInternet === hasInternet) {
        return
    }
    useNetworkStatusStore.getState().setHasInternet(hasInternet)
}

/** Skips the debounce — for the boot seed, which has no prior state. */
export const setConnectivity = (hasInternet: boolean): void => {
    clearOfflineTimer()
    applyConnectivity(hasInternet)
}

/**
 * Online applies immediately and cancels any pending offline timer. Offline is
 * trailing-debounced: flaps coalesce into the timer already in flight.
 */
export const handleConnectivityChange = (hasInternet: boolean): void => {
    liveSignalSinceBoot = true

    if (hasInternet) {
        clearOfflineTimer()
        applyConnectivity(true)
        return
    }

    if (offlineTimer !== null) {
        return
    }
    offlineTimer = setTimeout(() => {
        offlineTimer = null
        applyConnectivity(false)
    }, OFFLINE_DEBOUNCE_MS)
}

/** For listener teardown, and to reset the module timer between tests. */
export const cancelPendingConnectivityChange = (): void => {
    clearOfflineTimer()
}

/** Mirrors every store transition to `onlineManager`; nothing else writes it. */
export const bindOnlineManager = (): (() => void) =>
    useNetworkStatusStore.subscribe(state =>
        onlineManager.setOnline(state.hasInternet),
    )

/**
 * The URL comes from the caller (Remote Config, see useNetworkStatusListener)
 * so it can change without a redeploy. It MUST answer 204 with an empty body:
 * `reachabilityTest` treats anything else as unreachable, which is what unmasks
 * a captive portal answering 200 + HTML.
 */
export const configureNetInfo = (reachabilityUrl: string): void => {
    NetInfo.configure({
        reachabilityUrl,
        reachabilityMethod: 'HEAD',
        reachabilityTest: async response => response.status === 204,
        reachabilityShortTimeout: 5 * 1000,
        reachabilityLongTimeout: 60 * 1000,
        reachabilityRequestTimeout: 15 * 1000,
        useNativeReachability: true,
    })
}

/**
 * Seeds from a one-shot fetch so early queries never fire-and-fail against a
 * dead link. Runs at module load, before the query layer mounts — Remote Config
 * isn't ready yet, so the listener configures probing later; until then
 * NetInfo's built-in generate_204 default applies.
 */
export const initNetworkStatus = (): Promise<void> => {
    bindOnlineManager()

    liveSignalSinceBoot = false
    const seedIfStillAuthoritative = (hasInternet: boolean): void => {
        // A live event during boot supersedes this older, more optimistic
        // snapshot.
        if (liveSignalSinceBoot) {
            return
        }
        setConnectivity(hasInternet)
    }

    return NetInfo.fetch()
        .then(state => seedIfStillAuthoritative(computeHasInternet(state)))
        .catch(() => seedIfStillAuthoritative(false))
}

/**
 * `isInternetReachable` is tri-state, and `null` (not yet probed) counts as
 * reachable — otherwise the app flips offline on a link that simply hasn't
 * been probed yet.
 */
export const computeHasInternet = (state: NetInfoState): boolean =>
    state.isConnected === true && state.isInternetReachable !== false
