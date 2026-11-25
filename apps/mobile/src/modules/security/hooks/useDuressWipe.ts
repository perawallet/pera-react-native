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
import { useCreateAccount } from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import {
    clearAccountsStore,
    clearPendingWipe,
    useDeleteAllData,
} from '@hooks/useDeleteAllData'
import { UserPreferences } from '@constants/user-preferences'
import { useHomeChainScope } from '@hooks/useHomeChainScope'

type UseDuressWipeResult = {
    /**
     * Destructive: wipes all user data and silently provisions a fresh
     * locally-generated HD wallet account. The decoy account is what the user
     * (and, more importantly, an attacker observing the unlock) sees post-
     * wipe — an empty-but-functional wallet, indistinguishable from a normal
     * successful unlock other than the absence of balances and history.
     *
     * Failures drop silently to onboarding and keep the pending-wipe marker,
     * so the next launch finishes the wipe without showing a recovery screen.
     *
     * duress: do not emit analytics from this code path.
     */
    performDuressWipe: () => Promise<void>
}

export const useDuressWipe = (): UseDuressWipeResult => {
    const { wipeAllUserData } = useDeleteAllData()
    const scope = useHomeChainScope()
    const { createHdWalletAccount } = useCreateAccount(scope)
    const { setPreference } = usePreferences()

    const performDuressWipe = useCallback(async () => {
        try {
            await wipeAllUserData('duress')
        } catch {
            clearAccountsStore()
            return
        }

        try {
            // Account creation enables the home prompt before its sync resolves.
            setPreference(UserPreferences._securityPinSetupPrompt, true)

            await createHdWalletAccount({ account: 0, keyIndex: 0 })
            clearPendingWipe()
        } catch {
            clearAccountsStore()
        }
    }, [wipeAllUserData, createHdWalletAccount, setPreference])

    return { performDuressWipe }
}
