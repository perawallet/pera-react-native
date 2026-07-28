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
    useNotificationPreferences,
    useAccountNotificationEnabledMutation,
} from '@perawallet/wallet-core-messages'
import { useErrorToast } from './useErrorToast'
import { useLanguage } from './useLanguage'

export type UseAccountNotificationToggleResult = {
    /**
     * Flips an account's notification preference.
     *
     * Writes the persisted store optimistically so the switch moves at once,
     * then PATCHes the backend. On rejection the local write is reverted and a
     * cause-appropriate localized error is shown — offline failures get the
     * `errors.network.no_connection.*` copy via {@link useErrorToast}.
     *
     * Mutations run under `networkMode: 'always'` (PERA-4573), so offline
     * requests reject immediately rather than pausing. There is deliberately
     * no queue or replay: the local store must never hold a value the backend
     * was not told about, because it is persisted and would survive a restart.
     *
     * Toggles are serialised per address, app-wide: the in-flight guard is
     * module scope (shared by every hook instance, not just the one that
     * started the request), so while one is in flight a further call for the
     * same address — from this instance or any other — resolves `false`
     * immediately and touches neither the store nor the backend. Without
     * that guard two overlapping failures roll each other back to the wrong
     * value — tap-off then tap-on with both requests failing would settle
     * the store at `disabled` while the backend still holds `enabled`, and
     * the persisted store would carry that divergence across a restart.
     *
     * Note the guard's reactivity is *not* shared the same way: see
     * {@link isTogglePending}. Use it to disable the control instead of
     * silently dropping the tap.
     *
     * @returns `true` only when the backend accepted the change.
     */
    toggleAccountNotification: (
        address: string,
        enabled: boolean,
    ) => Promise<boolean>
    /**
     * Whether a toggle for `address` is currently in flight *as started by
     * this hook instance*. Re-renders when it changes, so it can drive a
     * control's `disabled` prop.
     *
     * The in-flight guard itself (no duplicate request, no store clobber) is
     * shared module-wide across every consumer of this hook. This flag is
     * not: it mirrors only the calls made through this instance, so a toggle
     * started from a different mounted instance (e.g. a different screen)
     * will not flip this instance's `isTogglePending` to `true`. A screen
     * that starts its own toggle for `address` will still see it settle
     * correctly, and the store can never diverge from the backend either
     * way — but two instances showing the same address will not visually
     * agree on "pending" mid-flight.
     */
    isTogglePending: (address: string) => boolean
}

// Module scope so the in-flight guard is shared by every hook instance —
// three call sites (useAccountOptions, and NotificationSettingsList mounted
// from both SettingsNotificationsScreen and NotificationSettingsContent) can
// otherwise each start their own overlapping request for the same address.
// See the guard note on `toggleAccountNotification` above.
const inFlightAddresses = new Set<string>()

/**
 * Tests only — never call from production code. The guard above is module
 * state, so without this a leaked entry from one test silently wedges an
 * unrelated test later in the same file.
 */
export const clearAccountNotificationToggleGuardForTests = (): void => {
    inFlightAddresses.clear()
}

export const useAccountNotificationToggle =
    (): UseAccountNotificationToggleResult => {
        const { setAccountEnabled } = useNotificationPreferences()
        const { mutateAsync } = useAccountNotificationEnabledMutation()
        const { showError } = useErrorToast()
        const { t } = useLanguage()

        // `inFlightAddresses` (module scope, above) is the synchronous source
        // of truth for the guard, shared app-wide: two taps in the same tick
        // — from this instance or another — must both see the first one.
        //
        // `ownPendingAddressesRef`/`pendingAddresses` below are local to this
        // instance and deliberately track only the addresses *this instance*
        // added to the shared set — never the shared set's full contents.
        // Copying the shared set wholesale would leak: if instance A starts
        // ADDR1 and instance B separately starts ADDR2, both entries land in
        // `inFlightAddresses`, and mirroring that whole set into B's local
        // state would make B report ADDR1 as pending even though B never
        // touched it — and that stale `true` would never clear, since only A
        // (not B) will remove ADDR1 from the shared set.
        const ownPendingAddressesRef = useRef<Set<string>>(new Set())
        const [pendingAddresses, setPendingAddresses] = useState<
            readonly string[]
        >([])

        const toggleAccountNotification = useCallback(
            async (address: string, enabled: boolean): Promise<boolean> => {
                if (inFlightAddresses.has(address)) {
                    return false
                }

                inFlightAddresses.add(address)
                ownPendingAddressesRef.current.add(address)
                setPendingAddresses([...ownPendingAddressesRef.current])
                setAccountEnabled(address, enabled)

                try {
                    await mutateAsync({ accountID: address, status: enabled })
                    return true
                } catch (error) {
                    setAccountEnabled(address, !enabled)
                    showError(error, t('common.error.title'))
                    return false
                } finally {
                    inFlightAddresses.delete(address)
                    ownPendingAddressesRef.current.delete(address)
                    setPendingAddresses([...ownPendingAddressesRef.current])
                }
            },
            [setAccountEnabled, mutateAsync, showError, t],
        )

        const isTogglePending = useCallback(
            (address: string): boolean => pendingAddresses.includes(address),
            [pendingAddresses],
        )

        return { toggleAccountNotification, isTogglePending }
    }
