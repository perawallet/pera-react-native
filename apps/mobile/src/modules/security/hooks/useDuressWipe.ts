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

import { useCallback } from 'react'
import { useCreateAccount } from '@perawallet/wallet-core-accounts'
import {
    clearAccountsStore,
    useDeleteAllData,
} from '@modules/settings/hooks/useDeleteAllData'

type UseDuressWipeResult = {
    /**
     * Destructive: wipes all user data and silently provisions a fresh
     * locally-generated HD wallet account. The decoy account is what the user
     * (and, more importantly, an attacker observing the unlock) sees post-
     * wipe — an empty-but-functional wallet, indistinguishable from a normal
     * successful unlock other than the absence of balances and history.
     *
     * Failure modes are absorbed silently: on any error the user still ends
     * up dropped into a logged-out / onboarding state rather than a half-
     * wiped logged-in state. This is intentional — leaking partial state
     * would defeat the plausible-deniability contract.
     *
     * duress: do not emit analytics from this code path.
     */
    performDuressWipe: () => Promise<void>
}

export const useDuressWipe = (): UseDuressWipeResult => {
    const { wipeAllUserData } = useDeleteAllData()
    const { createHdWalletAccount } = useCreateAccount()

    const performDuressWipe = useCallback(async () => {
        try {
            await wipeAllUserData()
        } catch {
            // If the wipe itself partially failed, the safer outcome is
            // "no accounts at all" — drop the user to onboarding instead of
            // letting them re-enter a half-wiped wallet.
            clearAccountsStore()
            return
        }

        // wipeAllUserData calls clearAllStores, which leaves the accounts
        // store empty. Provision a decoy by creating a brand-new HD wallet
        // account; the mnemonic is intentionally not surfaced anywhere —
        // it's a throwaway whose only job is to make the wallet look
        // "normal but empty" to any onlooker.
        try {
            await createHdWalletAccount({ account: 0, keyIndex: 0 })
        } catch {
            // Provisioning failed — fall through to the onboarding state.
            // (clearAccountsStore is a no-op here because the store is
            // already empty post-wipe, but stay explicit.)
            clearAccountsStore()
        }
    }, [wipeAllUserData, createHdWalletAccount])

    return { performDuressWipe }
}
