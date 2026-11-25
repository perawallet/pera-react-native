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

import { useCallback, useMemo, type ReactElement } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { ChainBadge } from '@components/ChainBadge'
import { ChainNotice } from '@components/ChainNotice'
import { EmptyView } from '@components/EmptyView'
import type { SearchableListSearchProps } from '@components/SearchableList'
import { useLanguage } from '@hooks/useLanguage'
import type { Optional } from '@perawallet/wallet-core-shared'
import { AddressSearchInput } from './AddressSearchInput'
import { AddressSearchRow } from './AddressSearchRow'
import { useStyles } from './styles'
import type {
    AddressSearchItem,
    AddressSearchNotice,
} from './useAddressSearchView'

export type UseAddressSearchListProps = {
    scope: ChainScope
    onSelected: (address: string, name?: string) => void
    setValue: (value: string) => void
    chainBadgeName: Optional<string>
    showAccountBalance: boolean
    hideBackupBadge?: boolean
    showAddIcon: boolean
    emptyStateMessage: Optional<{ title: string; body: string }>
    searchNotice: Optional<AddressSearchNotice>
}

export type UseAddressSearchListResult = {
    renderItem: (params: { item: AddressSearchItem }) => ReactElement
    SearchInput: (props: SearchableListSearchProps) => ReactElement
    renderSeparator: () => ReactElement
    keyExtractor: (item: AddressSearchItem) => string
    emptyComponent: () => ReactElement
    searchAccessory: Optional<ReactElement>
}

export const useAddressSearchList = ({
    scope,
    onSelected,
    setValue,
    chainBadgeName,
    showAccountBalance,
    hideBackupBadge,
    showAddIcon,
    emptyStateMessage,
    searchNotice,
}: UseAddressSearchListProps): UseAddressSearchListResult => {
    const styles = useStyles()
    const { t } = useLanguage()

    const chainBadge = useMemo(
        () =>
            chainBadgeName ? <ChainBadge name={chainBadgeName} /> : undefined,
        [chainBadgeName],
    )

    const renderItem = useCallback(
        ({ item }: { item: AddressSearchItem }) => (
            <AddressSearchRow
                item={item}
                scope={scope}
                onSelected={onSelected}
                setValue={setValue}
                chainBadge={chainBadge}
                showAccountBalance={showAccountBalance}
                hideBackupBadge={hideBackupBadge}
                showAddIcon={showAddIcon}
            />
        ),
        [
            scope,
            onSelected,
            setValue,
            chainBadge,
            showAccountBalance,
            hideBackupBadge,
            showAddIcon,
        ],
    )

    // SearchableList takes a component, so the scanned chain is bound here.
    const SearchInput = useMemo(() => {
        const chainIds = [scope.chainId]
        const BoundAddressSearchInput = (props: SearchableListSearchProps) => (
            <AddressSearchInput
                {...props}
                chainIds={chainIds}
            />
        )
        return BoundAddressSearchInput
    }, [scope.chainId])

    const renderSeparator = useCallback(
        () => <PWView style={styles.listSeparator} />,
        [styles],
    )

    const keyExtractor = useCallback((item: AddressSearchItem) => item.key, [])

    const emptyComponent = useCallback(
        () =>
            emptyStateMessage ? (
                <EmptyView
                    title={emptyStateMessage.title}
                    body={emptyStateMessage.body}
                    shouldTruncateBody={false}
                />
            ) : (
                <EmptyView
                    title={t('address_entry.no_accounts_found')}
                    body={t('address_entry.no_accounts_body')}
                />
            ),
        [t, emptyStateMessage],
    )

    const searchAccessory = useMemo(
        () =>
            searchNotice ? (
                <ChainNotice
                    kind='warning'
                    titleKey={searchNotice.titleKey}
                    params={searchNotice.params}
                />
            ) : undefined,
        [searchNotice],
    )

    return {
        renderItem,
        SearchInput,
        renderSeparator,
        keyExtractor,
        emptyComponent,
        searchAccessory,
    }
}
