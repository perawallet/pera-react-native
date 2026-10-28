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

import { memo, useCallback } from 'react'
import {
    ownAddressOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWFlatList } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { SelectableAccountRow } from '@components/SelectableAccountRow'

export type AccountPickerProps = {
    accounts: WalletAccount[]
    onSelect: (account: WalletAccount) => void
    highlightedAddress?: string
    /** Body text for the empty state; omit to render no empty state. */
    emptyBody?: string
    rowTestIDPrefix?: string
    /**
     * Lays the list out inside a parent scroll (e.g. `PWSheetLayout`) instead
     * of scrolling itself. A second sheet scrollable would overwrite the
     * sheet's measured height with the list's alone, cutting off the parent's
     * header and safe-area padding.
     */
    isEmbedded?: boolean
    /** The chain the pick is for; rows then show that chain's address and balance rather than the whole account's. */
    chainId?: ChainId
}

const keyExtractor = (account: WalletAccount) => account.id

const AccountPickerComponent = ({
    accounts,
    onSelect,
    highlightedAddress,
    emptyBody,
    rowTestIDPrefix,
    isEmbedded = false,
    chainId,
}: AccountPickerProps) => {
    const renderItem = useCallback(
        ({ item }: { item: WalletAccount }) => (
            <SelectableAccountRow
                account={item}
                onSelect={onSelect}
                chainId={chainId}
                isHighlighted={
                    highlightedAddress != null &&
                    ownAddressOf(item) === highlightedAddress
                }
                testID={
                    rowTestIDPrefix
                        ? `${rowTestIDPrefix}-${ownAddressOf(item)}`
                        : undefined
                }
            />
        ),
        [onSelect, highlightedAddress, rowTestIDPrefix, chainId],
    )

    const renderEmpty = useCallback(
        () => <EmptyView body={emptyBody ?? ''} />,
        [emptyBody],
    )

    return (
        <PWFlatList
            cardLayout
            data={accounts}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListEmptyComponent={emptyBody != null ? renderEmpty : undefined}
            inBottomSheet={isEmbedded ? false : undefined}
            scrollEnabled={!isEmbedded}
        />
    )
}

export const AccountPicker = memo(AccountPickerComponent)
