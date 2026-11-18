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

import { useCallback } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useDevice, useDeviceStore } from '@perawallet/wallet-core-device'
import { useDeviceAccountRegistrations } from '@hooks/useDeviceAccountRegistrations'
import { useGuardedToggle } from '@hooks/useGuardedToggle'

export type UseNetworkNotificationToggleResult = {
    /**
     * Writes the mute optimistically, then re-registers the device, rolling
     * back on rejection. Resolves `true` only when the backend accepted; a
     * second call for a chain already in flight, from any instance, resolves
     * `false` without touching the store or backend.
     */
    toggleNetworkNotification: (
        chainId: ChainId,
        enabled: boolean,
    ) => Promise<boolean>
    /** Reactive for the instance that started the toggle only; the guard itself is app-wide. */
    isTogglePending: (chainId: ChainId) => boolean
}

// Module scope so overlapping toggles from different mounted sections can't
// roll each other back to the wrong value.
const inFlightChains = new Set<ChainId>()

/** Tests only; a leaked entry would wedge an unrelated test in the same file. */
export const clearNetworkNotificationToggleGuardForTests = (): void => {
    inFlightChains.clear()
}

export const useNetworkNotificationToggle =
    (): UseNetworkNotificationToggleResult => {
        const setChainMuted = useDeviceStore(state => state.setChainMuted)
        const accountRegistrations = useDeviceAccountRegistrations()
        const { registerDevice } = useDevice()
        const { runToggle, isTogglePending } = useGuardedToggle(inFlightChains)

        const toggleNetworkNotification = useCallback(
            (chainId: ChainId, enabled: boolean): Promise<boolean> =>
                runToggle([chainId], {
                    write: () => setChainMuted(chainId, !enabled),
                    // The registration reads the store's muted chains when it
                    // runs, so the write above is what it sends.
                    commit: async () => {
                        await registerDevice(accountRegistrations)
                    },
                    rollback: () => setChainMuted(chainId, enabled),
                }),
            [runToggle, setChainMuted, accountRegistrations, registerDevice],
        )

        return { toggleNetworkNotification, isTogglePending }
    }
