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

import { memo, useCallback } from 'react'
import { PWFlatList } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { SelectableAccountRow } from '@modules/accounts/components/SelectableAccountRow'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

export type AccountPickerProps = {
    accounts: WalletAccount[]
    onSelect: (account: WalletAccount) => void
    /** Highlights the row whose address matches (e.g. the current selection). */
    highlightedAddress?: string
    /** Body text for the empty state; omit to render no empty state. */
    emptyBody?: string
    /** Row testID becomes `${rowTestIDPrefix}-${address}`; defaults to the
     *  SelectableAccountRow default (`account-row-${address}`). */
    rowTestIDPrefix?: string
}

const keyExtractor = (account: WalletAccount) => account.address

/**
 * Single-select account list shared across the receive, gift-card and rekey
 * flows. Wraps the card-layout list + row + empty state so each screen only
 * supplies its accounts, an `onSelect`, and (optionally) a header around it.
 * Scroll-in-sheet cooperation is handled automatically by PWFlatList.
 */
const AccountPickerComponent = ({
    accounts,
    onSelect,
    highlightedAddress,
    emptyBody,
    rowTestIDPrefix,
}: AccountPickerProps) => {
    const renderItem = useCallback(
        ({ item }: { item: WalletAccount }) => (
            <SelectableAccountRow
                account={item}
                onSelect={onSelect}
                isHighlighted={
                    highlightedAddress != null &&
                    item.address === highlightedAddress
                }
                testID={
                    rowTestIDPrefix
                        ? `${rowTestIDPrefix}-${item.address}`
                        : undefined
                }
            />
        ),
        [onSelect, highlightedAddress, rowTestIDPrefix],
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
        />
    )
}

export const AccountPicker = memo(AccountPickerComponent)
