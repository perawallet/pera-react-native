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

import { useCallback, useMemo } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useSwapSourceScope,
    useSwapsStore,
} from '@perawallet/wallet-core-swaps'
import {
    useAccountChainSelection,
    type AccountChainRow,
} from '@modules/transactions/chain-selection'

export type UseSwapSourceChainRowResult = {
    isVisible: boolean
    chainId: Nullable<ChainId>
    rows: AccountChainRow[]
    handleSelectChain: (chainId: ChainId) => void
}

export const useSwapSourceChainRow = (
    account: Nullable<WalletAccount>,
): UseSwapSourceChainRowResult => {
    const chainId = useSwapSourceScope(account)?.chainId ?? null
    const setSourceChainId = useSwapsStore(state => state.setSourceChainId)

    const handleChosenChain = useCallback(
        (next: ChainId) => {
            if (next !== chainId) setSourceChainId(next)
        },
        [chainId, setSourceChainId],
    )

    const { rows, handleSelectChain } = useAccountChainSelection({
        account: account ?? undefined,
        capability: 'swap',
        isSignerRequired: true,
        onSelectChain: handleChosenChain,
    })
    const enabledRows = useMemo(() => rows.filter(row => row.isEnabled), [rows])

    return {
        isVisible: enabledRows.length > 1,
        chainId,
        rows: enabledRows,
        handleSelectChain,
    }
}
