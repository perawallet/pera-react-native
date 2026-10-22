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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { PWListItem, PWSheetLayout } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'

export type ChainSelectionContentProps = {
    chainIds: ChainId[]
    /** Header text; defaults to asking which chain an address is on. */
    title?: string
}

/** Resolves the picked chain's id. */
export const ChainSelectionContent = ({
    chainIds,
    title,
}: ChainSelectionContentProps) => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<ChainId>()

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={title ?? t('deeplink.select_chain.title')}
                />
            }
        >
            {chainIds.map(chainId => (
                <PWListItem
                    key={chainId}
                    icon='globe'
                    title={getChainDescriptor(chainId).displayName}
                    onPress={() => resolve(chainId)}
                    testID={`chain_selection_${chainId}`}
                />
            ))}
        </PWSheetLayout>
    )
}
