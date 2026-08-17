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
import {
    isQuantumAccount,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import {
    QuantumDappWarningSheet,
    type QuantumDappWarningDecision,
} from '@components/QuantumDappWarningSheet'
import { useBottomSheet } from '@modules/bottom-sheet'
import { UserPreferences } from '@constants/user-preferences'
import { useIsQuantumDappWarningEnabled } from './useIsQuantumDappWarningEnabled'

export type UseQuantumDappWarningResult = {
    // Resolves 'continue' unless a quantum account is involved, the warning
    // is enabled, and it has not been acknowledged before.
    confirmQuantumDappUsage: (
        addresses: string[],
    ) => Promise<QuantumDappWarningDecision>
}

export const useQuantumDappWarning = (): UseQuantumDappWarningResult => {
    const isEnabled = useIsQuantumDappWarningEnabled()
    const accounts = useAllAccounts()
    const { getPreference, setPreference } = usePreferences()
    const { request } = useBottomSheet()

    const confirmQuantumDappUsage = useCallback(
        async (addresses: string[]): Promise<QuantumDappWarningDecision> => {
            if (!isEnabled) return 'continue'
            if (getPreference(UserPreferences.quantumDappWarningAcknowledged))
                return 'continue'

            const hasQuantumAccount = addresses.some(address => {
                const account = accounts.find(a => a.address === address)
                return !!account && isQuantumAccount(account)
            })
            if (!hasQuantumAccount) return 'continue'

            const result = await request<QuantumDappWarningDecision>({
                contents: <QuantumDappWarningSheet />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                },
            })

            // Dismiss (cancel, backdrop, unmount) settles as undefined; fail
            // closed rather than treat that as an implicit continue.
            if (result !== 'continue') return 'cancel'

            setPreference(UserPreferences.quantumDappWarningAcknowledged, true)
            return 'continue'
        },
        [isEnabled, accounts, getPreference, setPreference, request],
    )

    return { confirmQuantumDappUsage }
}
