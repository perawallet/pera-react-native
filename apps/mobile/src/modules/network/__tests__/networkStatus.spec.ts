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

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import {
    computeHasInternet,
    handleConnectivityChange,
    setConnectivity,
    cancelPendingConnectivityChange,
    bindOnlineManager,
    configureNetInfo,
    initNetworkStatus,
    REACHABILITY_URL,
    OFFLINE_DEBOUNCE_MS,
} from '../networkStatus'
import { useNetworkStatusStore } from '../hooks/useNetworkStatusStore'

vi.mock('@react-native-community/netinfo', () => ({
    default: {
        configure: vi.fn(),
        fetch: vi.fn(),
        addEventListener: vi.fn(),
    },
}))

vi.mock('@tanstack/react-query', () => ({
    onlineManager: { setOnline: vi.fn() },
}))

const netInfoState = (partial: Partial<NetInfoState>): NetInfoState =>
    ({
        isConnected: null,
        isInternetReachable: null,
        ...partial,
    }) as NetInfoState

describe('computeHasInternet', () => {
    it('is true when connected and reachability is confirmed', () => {
        expect(
            computeHasInternet(
                netInfoState({ isConnected: true, isInternetReachable: true }),
            ),
        ).toBe(true)
    })

    it('is false when not connected at the link level', () => {
        expect(
            computeHasInternet(
                netInfoState({
                    isConnected: false,
                    isInternetReachable: false,
                }),
            ),
        ).toBe(false)
    })

    it('is false on a connected-but-unreachable link (captive portal)', () => {
        expect(
            computeHasInternet(
                netInfoState({
                    isConnected: true,
                    isInternetReachable: false,
                }),
            ),
        ).toBe(false)
    })

    it('treats unknown reachability (null) as reachable to avoid false offline', () => {
        expect(
            computeHasInternet(
                netInfoState({ isConnected: true, isInternetReachable: null }),
            ),
        ).toBe(true)
    })
})

describe('connectivity transitions', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        useNetworkStatusStore.setState({ hasInternet: true })
    })

    afterEach(() => {
        cancelPendingConnectivityChange()
        vi.useRealTimers()
    })

    it('applies a going-offline transition only after the debounce window', () => {
        handleConnectivityChange(false)

        // Still online right after the event fires...
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)

        // ...until the trailing debounce window elapses.
        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
        expect(useNetworkStatusStore.getState().hasInternet).toBe(false)
    })

    it('applies a going-online transition immediately (instant recovery)', () => {
        useNetworkStatusStore.setState({ hasInternet: false })

        handleConnectivityChange(true)

        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
    })

    it('cancels a pending offline transition when connection recovers within the window', () => {
        handleConnectivityChange(false)
        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS / 2)

        handleConnectivityChange(true)
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)

        // The stale offline timer must not fire after recovery.
        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
    })

    it('coalesces rapid flapping into a single settled transition', () => {
        const transitions: boolean[] = []
        const unsubscribe = useNetworkStatusStore.subscribe(state =>
            transitions.push(state.hasInternet),
        )

        // Rapid off/on/off flapping, each flip well inside the window.
        handleConnectivityChange(false)
        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS / 4)
        handleConnectivityChange(true)
        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS / 4)
        handleConnectivityChange(false)
        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS / 4)

        // No transition has been committed while flapping.
        expect(transitions).toEqual([])

        // Once it settles offline for a full window, exactly one transition.
        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
        unsubscribe()

        expect(transitions).toEqual([false])
        expect(useNetworkStatusStore.getState().hasInternet).toBe(false)
    })

    it('restores connectivity immediately when a link reconnects after settling offline', () => {
        // Link drops and the offline transition settles.
        handleConnectivityChange(false)
        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
        expect(useNetworkStatusStore.getState().hasInternet).toBe(false)

        // Reconnecting is applied at once — no debounce on recovery.
        handleConnectivityChange(true)
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
    })

    it('setConnectivity applies immediately and clears any pending transition', () => {
        handleConnectivityChange(false)

        setConnectivity(true)
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)

        vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
    })
})

describe('bindOnlineManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNetworkStatusStore.setState({ hasInternet: true })
    })

    it('mirrors every store connectivity change to onlineManager', () => {
        const unbind = bindOnlineManager()

        useNetworkStatusStore.getState().setHasInternet(false)
        expect(onlineManager.setOnline).toHaveBeenLastCalledWith(false)

        useNetworkStatusStore.getState().setHasInternet(true)
        expect(onlineManager.setOnline).toHaveBeenLastCalledWith(true)

        unbind()
    })

    it('stops mirroring once unbound', () => {
        const unbind = bindOnlineManager()
        unbind()

        useNetworkStatusStore.getState().setHasInternet(false)
        expect(onlineManager.setOnline).not.toHaveBeenCalled()
    })
})

describe('configureNetInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('configures active reachability probing against a 204 endpoint', () => {
        configureNetInfo()

        expect(NetInfo.configure).toHaveBeenCalledWith(
            expect.objectContaining({
                reachabilityUrl: REACHABILITY_URL,
                reachabilityShortTimeout: 5 * 1000,
                reachabilityLongTimeout: 60 * 1000,
                useNativeReachability: true,
            }),
        )
    })

    it('treats an HTTP 204 response as reachable', async () => {
        configureNetInfo()

        const config = vi.mocked(NetInfo.configure).mock.calls[0][0]
        await expect(
            config.reachabilityTest?.({ status: 204 } as Response),
        ).resolves.toBe(true)
        await expect(
            config.reachabilityTest?.({ status: 500 } as Response),
        ).resolves.toBe(false)
    })
})

describe('initNetworkStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNetworkStatusStore.setState({ hasInternet: true })
    })

    it('configures reachability probing before seeding connectivity', async () => {
        vi.mocked(NetInfo.fetch).mockResolvedValue(
            netInfoState({ isConnected: true, isInternetReachable: true }),
        )

        await initNetworkStatus()

        expect(NetInfo.configure).toHaveBeenCalled()
    })

    it('seeds the store offline on a cold start with no connection', async () => {
        vi.mocked(NetInfo.fetch).mockResolvedValue(
            netInfoState({ isConnected: false, isInternetReachable: false }),
        )

        await initNetworkStatus()

        expect(useNetworkStatusStore.getState().hasInternet).toBe(false)
    })

    it('seeds the store offline behind a captive portal', async () => {
        vi.mocked(NetInfo.fetch).mockResolvedValue(
            netInfoState({ isConnected: true, isInternetReachable: false }),
        )

        await initNetworkStatus()

        expect(useNetworkStatusStore.getState().hasInternet).toBe(false)
    })

    it('seeds the store online when the cold-start probe succeeds', async () => {
        useNetworkStatusStore.setState({ hasInternet: false })
        vi.mocked(NetInfo.fetch).mockResolvedValue(
            netInfoState({ isConnected: true, isInternetReachable: true }),
        )

        await initNetworkStatus()

        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
    })

    it('treats a failed cold-start probe as offline', async () => {
        vi.mocked(NetInfo.fetch).mockRejectedValue(new Error('no network'))

        await initNetworkStatus()

        expect(useNetworkStatusStore.getState().hasInternet).toBe(false)
    })

    it('does not let a slow boot seed override a live offline state committed while it was pending', async () => {
        vi.useFakeTimers()
        try {
            // The boot probe is slow to resolve (active reachability can take
            // seconds); the listener is already live in the meantime.
            let resolveFetch: (state: NetInfoState) => void = () => {}
            vi.mocked(NetInfo.fetch).mockReturnValue(
                new Promise<NetInfoState>(resolve => {
                    resolveFetch = resolve
                }),
            )

            const booting = initNetworkStatus()

            // A live captive-portal event arrives and settles offline.
            handleConnectivityChange(false)
            vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
            expect(useNetworkStatusStore.getState().hasInternet).toBe(false)

            // The stale boot probe finally resolves optimistically (reachability
            // still unknown) — it must not clobber the fresher live offline state.
            resolveFetch(
                netInfoState({ isConnected: true, isInternetReachable: null }),
            )
            await booting

            expect(useNetworkStatusStore.getState().hasInternet).toBe(false)
        } finally {
            cancelPendingConnectivityChange()
            vi.useRealTimers()
        }
    })
})
