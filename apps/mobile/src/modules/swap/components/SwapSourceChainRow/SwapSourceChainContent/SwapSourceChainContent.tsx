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
import { PWSheetLayout } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import {
    ChainSelectionList,
    type AccountChainRow,
} from '@modules/transactions/chain-selection'
import { useLanguage } from '@hooks/useLanguage'

export type SwapSourceChainContentProps = {
    rows: AccountChainRow[]
    onSelectChain: (chainId: ChainId) => void
}

export const SwapSourceChainContent = ({
    rows,
    onSelectChain,
}: SwapSourceChainContentProps) => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<ChainId>()

    // A new chain remounts the form that opened this sheet, so resolve first.
    const handleSelect = useCallback(
        (chainId: ChainId) => {
            resolve(chainId)
            onSelectChain(chainId)
        },
        [resolve, onSelectChain],
    )

    return (
        <PWSheetLayout
            header={<SheetHeader title={t('chain_selection.title')} />}
        >
            <ChainSelectionList
                rows={rows}
                enablingChainId={undefined}
                onSelectChain={handleSelect}
                // Every row is an enabled chain, so no add action renders.
                onAddChain={handleSelect}
                testIDPrefix='swap_source_chain'
            />
        </PWSheetLayout>
    )
}
