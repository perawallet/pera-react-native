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

import { useCallback, useRef, useState } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    buildDeviceAccountRegistrations,
    useDevice,
    useDeviceStore,
} from '@perawallet/wallet-core-device'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { assertOnline } from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'

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
        const { disabledAccounts } = useNotificationPreferences()
        const accounts = useAllAccounts()
        const { registerDevice } = useDevice()
        const { showError } = useErrorToast()
        const { t } = useLanguage()

        const ownPendingChainsRef = useRef<Set<ChainId>>(new Set())
        const [pendingChains, setPendingChains] = useState<readonly ChainId[]>(
            [],
        )

        const toggleNetworkNotification = useCallback(
            async (chainId: ChainId, enabled: boolean): Promise<boolean> => {
                if (inFlightChains.has(chainId)) return false

                inFlightChains.add(chainId)
                ownPendingChainsRef.current.add(chainId)
                setPendingChains([...ownPendingChainsRef.current])
                setChainMuted(chainId, !enabled)

                try {
                    // Registration runs under networkMode 'always' and Android
                    // offline doesn't reject promptly, so fail before it to
                    // keep the rollback below reachable.
                    assertOnline()

                    // The registration reads the store's muted chains when it
                    // runs, so the write above is what it sends.
                    await registerDevice(
                        buildDeviceAccountRegistrations(
                            accounts,
                            disabledAccounts,
                        ),
                    )
                    return true
                } catch (error) {
                    setChainMuted(chainId, enabled)
                    showError(error, t('common.error.title'))
                    return false
                } finally {
                    inFlightChains.delete(chainId)
                    ownPendingChainsRef.current.delete(chainId)
                    setPendingChains([...ownPendingChainsRef.current])
                }
            },
            [
                setChainMuted,
                accounts,
                disabledAccounts,
                registerDevice,
                showError,
                t,
            ],
        )

        const isTogglePending = useCallback(
            (chainId: ChainId): boolean => pendingChains.includes(chainId),
            [pendingChains],
        )

        return { toggleNetworkNotification, isTogglePending }
    }
