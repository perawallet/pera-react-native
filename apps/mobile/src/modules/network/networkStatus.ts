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
 * Endpoint used to actively probe internet reachability. A successful probe
 * returns HTTP 204 (empty body). iOS has no native reachability signal, so
 * without an explicit probe URL `isInternetReachable` never turns `false` on a
 * captive portal / dead-gateway link — configuring this is what unifies
 * captive-portal detection across platforms.
 *
 * TODO(PERA-4570): swap for a Pera-controlled 204 endpoint once ops hosts it;
 * Google's `generate_204` is the agreed interim.
 */
export const REACHABILITY_URL = 'https://clients3.google.com/generate_204'

/**
 * Trailing debounce applied before committing a going-offline transition.
 * Rapid airplane-mode flapping (PERA-4543 Part A) collapses to at most one
 * transition per window; going online is applied immediately so recovery
 * feels instant.
 */
export const OFFLINE_DEBOUNCE_MS = 2000

let offlineTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Set once a live NetInfo event has been handled after the current boot began.
 * The boot seed's `fetch()` can resolve seconds later (active reachability
 * probing), by which point the listener may already have committed a fresher
 * state — the stale boot result must not clobber it.
 */
let liveSignalSinceBoot = false

const clearOfflineTimer = (): void => {
    if (offlineTimer !== null) {
        clearTimeout(offlineTimer)
        offlineTimer = null
    }
}

/**
 * Commit a connectivity value to the store. The store is the single source of
 * truth (and the only writer to TanStack Query's `onlineManager`), so this is
 * the one place connectivity state is mutated. No-ops when the value is
 * unchanged to avoid redundant transitions.
 */
const applyConnectivity = (hasInternet: boolean): void => {
    if (useNetworkStatusStore.getState().hasInternet === hasInternet) {
        return
    }
    useNetworkStatusStore.getState().setHasInternet(hasInternet)
}

/**
 * Apply a connectivity value immediately, cancelling any pending debounced
 * transition. Used for the boot seed where there is no prior state to debounce.
 */
export const setConnectivity = (hasInternet: boolean): void => {
    clearOfflineTimer()
    applyConnectivity(hasInternet)
}

/**
 * Handle a live connectivity change from NetInfo.
 * - Going online applies immediately and cancels any pending offline timer.
 * - Going offline is trailing-debounced: rapid flaps coalesce into the single
 *   timer already in flight, and recovery within the window cancels it.
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

/**
 * Cancel any pending debounced offline transition. Used on listener teardown
 * and in tests to reset the module timer between cases.
 */
export const cancelPendingConnectivityChange = (): void => {
    clearOfflineTimer()
}

/**
 * Wire the connectivity store to TanStack Query's `onlineManager` so the store
 * is the single source of truth: every store transition is mirrored to
 * `onlineManager`, and nothing else writes to it. Returns an unsubscribe fn.
 */
export const bindOnlineManager = (): (() => void) =>
    useNetworkStatusStore.subscribe(state =>
        onlineManager.setOnline(state.hasInternet),
    )

/**
 * Configure NetInfo's active reachability probing. The URL is supplied by the
 * caller (sourced from Remote Config, see useNetworkStatusListener) so it can
 * change without a redeploy; it MUST return HTTP 204 with an empty body, since
 * `reachabilityTest` treats anything else as unreachable — that is what unmasks
 * a captive portal answering 200 + HTML. Conservative timeouts (5s short / 60s
 * long) keep the probe cheap while giving iOS the captive-portal detection
 * Android already gets via NET_CAPABILITY_VALIDATED.
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
 * Boot seed for connectivity. Wires the store to `onlineManager`, then seeds it
 * from a one-shot fetch routed through {@link computeHasInternet} so early
 * queries never fire-and-fail against a dead link. Runs once at module load,
 * before the query layer mounts (see App.tsx) — the provider (and thus Remote
 * Config) is not ready yet, so reachability probing is configured later by the
 * listener; until then NetInfo's built-in generate_204 default applies.
 */
export const initNetworkStatus = (): Promise<void> => {
    bindOnlineManager()

    liveSignalSinceBoot = false
    const seedIfStillAuthoritative = (hasInternet: boolean): void => {
        // A live event during boot supersedes this (older, more optimistic)
        // snapshot — don't clobber the fresher state.
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
 * Single source of truth for "is the app actually online?".
 *
 * Combines NetInfo's link-level `isConnected` with its actively-probed
 * `isInternetReachable`. NetInfo reachability is tri-state:
 * - `true`  → probe succeeded, internet confirmed
 * - `false` → probe failed (captive portal / dead gateway), treat as offline
 * - `null`  → not yet known; treated as reachable so we never flip the app
 *   offline on a link that simply hasn't been probed yet.
 */
export const computeHasInternet = (state: NetInfoState): boolean =>
    state.isConnected === true && state.isInternetReachable !== false
