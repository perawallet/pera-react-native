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
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    buildDeviceAccountRegistrations,
    useDevice,
} from '@perawallet/wallet-core-device'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { assertOnline } from '@perawallet/wallet-core-shared'
import { useErrorToast } from './useErrorToast'
import { useLanguage } from './useLanguage'

export type UseAccountNotificationToggleResult = {
    /**
     * Writes the store optimistically so the switch moves at once, then
     * re-registers the device with the flag applied inline (the API has no
     * per-account route), reverting on rejection. Resolves `true` only when the
     * backend accepted.
     *
     * Deliberately no queue or replay: the store is persisted, so it must never
     * hold a value the backend wasn't told about.
     *
     * Toggles are serialised per address app-wide — the in-flight guard is
     * module scope, so a second call for the same address from ANY instance
     * resolves `false` without touching the store or backend. Without it, two
     * overlapping failures roll each other back to the wrong value: tap-off then
     * tap-on, both failing, settles the store at `disabled` while the backend
     * holds `enabled`, and that divergence survives a restart.
     *
     * The guard's reactivity is not shared the same way — see
     * {@link isTogglePending}, and use it to disable the control rather than
     * dropping the tap silently.
     */
    toggleAccountNotification: (
        address: string,
        enabled: boolean,
    ) => Promise<boolean>
    /**
     * In flight *as started by this instance*, and reactive so it can drive a
     * `disabled` prop.
     *
     * Unlike the guard itself, this is NOT shared module-wide: a toggle started
     * from another mounted instance won't flip this one's flag. Correctness is
     * unaffected — the store can't diverge either way — but two instances
     * showing the same address won't visually agree on "pending" mid-flight.
     */
    isTogglePending: (address: string) => boolean
}

// Module scope so the guard is shared by every hook instance — three call sites
// could otherwise each start an overlapping request for the same address.
const inFlightAddresses = new Set<string>()

/**
 * Tests only. The guard is module state, so a leaked entry silently wedges an
 * unrelated test later in the same file.
 */
export const clearAccountNotificationToggleGuardForTests = (): void => {
    inFlightAddresses.clear()
}

// Registration mutes an account on every chain once any of its addresses is
// muted, so the stored preference moves all of them together; otherwise an
// account muted through one address could only be unmuted through that one.
// Every account holding the address counts: a watch account can share one
// with a signing account that also holds addresses on other chains.
const addressesOfAccountsHolding = (
    accounts: readonly WalletAccount[],
    address: string,
): string[] => {
    const holders = accounts.filter(candidate =>
        Object.values(candidate.chains).some(
            entry => entry?.address === address,
        ),
    )
    const addresses = holders.flatMap(holder =>
        Object.values(holder.chains).flatMap(entry =>
            entry === undefined ? [] : [entry.address],
        ),
    )
    return addresses.length === 0 ? [address] : [...new Set(addresses)]
}

export const useAccountNotificationToggle =
    (): UseAccountNotificationToggleResult => {
        const { disabledAccounts, setAccountEnabled } =
            useNotificationPreferences()
        const accounts = useAllAccounts()
        const { registerDevice } = useDevice()
        const { showError } = useErrorToast()
        const { t } = useLanguage()

        // `inFlightAddresses` is module-scoped so two taps in the same tick,
        // from any instance, both see the first one.
        //
        // The local refs track only what THIS instance added, never the shared
        // set's full contents: mirroring it wholesale would make one instance
        // report another's address as pending, and that stale `true` would
        // never clear, since only the owner removes it.
        const ownPendingAddressesRef = useRef<Set<string>>(new Set())
        const [pendingAddresses, setPendingAddresses] = useState<
            readonly string[]
        >([])

        const toggleAccountNotification = useCallback(
            async (address: string, enabled: boolean): Promise<boolean> => {
                // Guarded per account: the write below moves every address
                // it holds, whichever one the caller toggled through.
                const accountAddresses = addressesOfAccountsHolding(
                    accounts,
                    address,
                )
                if (
                    accountAddresses.some(each => inFlightAddresses.has(each))
                ) {
                    return false
                }

                accountAddresses.forEach(each => {
                    inFlightAddresses.add(each)
                    ownPendingAddressesRef.current.add(each)
                })
                setPendingAddresses([...ownPendingAddressesRef.current])
                accountAddresses.forEach(each =>
                    setAccountEnabled(each, enabled),
                )

                try {
                    // Fail fast offline instead of trusting the native
                    // transport to reject. Registration runs under
                    // networkMode 'always', and iOS rejects promptly while
                    // Android in airplane mode does not — so without this the
                    // rollback below never ran and the persisted store diverged
                    // from the backend.
                    assertOnline()

                    // The API has no per-account route: notification flags ride
                    // inline on the full accounts array. Compute the post-
                    // toggle disabled set explicitly rather than re-reading
                    // the store, which has not re-rendered this closure yet.
                    const nextDisabled = enabled
                        ? disabledAccounts.filter(
                              disabled => !accountAddresses.includes(disabled),
                          )
                        : [
                              ...new Set([
                                  ...disabledAccounts,
                                  ...accountAddresses,
                              ]),
                          ]

                    await registerDevice(
                        buildDeviceAccountRegistrations(accounts, nextDisabled),
                    )
                    return true
                } catch (error) {
                    accountAddresses.forEach(each =>
                        setAccountEnabled(each, !enabled),
                    )
                    showError(error, t('common.error.title'))
                    return false
                } finally {
                    accountAddresses.forEach(each => {
                        inFlightAddresses.delete(each)
                        ownPendingAddressesRef.current.delete(each)
                    })
                    setPendingAddresses([...ownPendingAddressesRef.current])
                }
            },
            [
                setAccountEnabled,
                disabledAccounts,
                accounts,
                registerDevice,
                showError,
                t,
            ],
        )

        const isTogglePending = useCallback(
            (address: string): boolean => pendingAddresses.includes(address),
            [pendingAddresses],
        )

        return { toggleAccountNotification, isTogglePending }
    }
