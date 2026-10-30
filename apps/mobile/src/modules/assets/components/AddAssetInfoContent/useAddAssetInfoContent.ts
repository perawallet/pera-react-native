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

import { useMemo } from 'react'
import {
    useAccountHoldingSources,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'

type UseAddAssetInfoContentResult = {
    /** The account is on a chain that adds without opt-in, so the sheet says how that differs. */
    hasAddingNotes: boolean
    /** Set beside the EVM note when the account also adds by opting in. */
    hasOptInNote: boolean
}

export const useAddAssetInfoContent = (): UseAddAssetInfoContentResult => {
    const selectedAccount = useAccountsStore(state =>
        state.getSelectedAccount(),
    )
    const holdingSources = useAccountHoldingSources(selectedAccount)
    return useMemo(() => {
        const optIns = holdingSources.map(
            ({ scope }) =>
                getChainDescriptor(scope.chainId).protocol.requiresAssetOptIn,
        )
        return {
            hasAddingNotes: optIns.some(requiresOptIn => !requiresOptIn),
            hasOptInNote: optIns.some(Boolean),
        }
    }, [holdingSources])
}
