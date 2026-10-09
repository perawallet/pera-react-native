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
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
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
}

const addressOf = (account: WalletAccount, chainId: ChainId) =>
    chainAccountOf(account, chainId)?.address

const AccountPickerComponent = ({
    accounts,
    onSelect,
    highlightedAddress,
    emptyBody,
    rowTestIDPrefix,
}: AccountPickerProps) => {
    const keyExtractor = useCallback(
        (account: WalletAccount) =>
            addressOf(account, LEGACY_CHAIN_ID) ?? account.id,
        [],
    )
    const renderItem = useCallback(
        ({ item }: { item: WalletAccount }) => (
            <SelectableAccountRow
                account={item}
                onSelect={onSelect}
                isHighlighted={
                    highlightedAddress != null &&
                    addressOf(item, LEGACY_CHAIN_ID) === highlightedAddress
                }
                testID={
                    rowTestIDPrefix
                        ? `${rowTestIDPrefix}-${addressOf(item, LEGACY_CHAIN_ID)}`
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
