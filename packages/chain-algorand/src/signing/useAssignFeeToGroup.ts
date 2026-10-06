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
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    useFetchSuggestedMinFee,
    useMinimumFeeConfig,
} from '@perawallet/wallet-core-blockchain'
import type { AssignFeeToGroup } from '@perawallet/wallet-core-signing'
import { assignFeeToGroup } from './assignMinimumFeesToGroup'

// The suggested-params fetch goes through `useFetchSuggestedMinFee`, the
// shared query cache, and never blocks the flow: on failure it falls back to
// 0, leaving only the remote-config base in effect.
export const useAssignFeeToGroup = (): AssignFeeToGroup => {
    const fetchSuggestedMinFee = useFetchSuggestedMinFee()
    const { minTxnFee, pqMultiplier } = useMinimumFeeConfig()

    return useCallback<AssignFeeToGroup>(
        params =>
            assignFeeToGroup(params, {
                // Read live store state at call time, not a value captured at
                // render: WalletConnect can invoke this after the owning
                // component has unmounted, holding a frozen closure over a
                // pre-rekey accounts array otherwise.
                accounts: useAccountsStore.getState().accounts,
                fetchSuggestedMinFee: () =>
                    fetchSuggestedMinFee({ fallback: 0n }),
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            }),
        [fetchSuggestedMinFee, minTxnFee, pqMultiplier],
    )
}
