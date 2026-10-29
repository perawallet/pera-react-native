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

import type { PWViewProps } from '@components/core/PWView'
import { EmptyView } from '@components/EmptyView'
import { OfflineTolerantView } from '@components/OfflineTolerantView'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionHistorySearchOlder } from '../TransactionHistorySearchOlder'

export type TransactionHistoryLoadStateProps = {
    isLoadFailed: boolean
    isLoadUnavailable: boolean
    isLoadIntegrityBlocked: boolean
    /** The failed read happened offline. */
    isLoadOffline: boolean
    isRetrying: boolean
    onRetry: () => void
    isSearchPaused: boolean
    onSearchOlder: () => void
    /** Offline with nothing cached: not the same claim as an empty history. */
    isOfflineEmpty: boolean
    /** Replaces the default empty-history copy. */
    emptyBody?: string
    /** Renders the empty view's loading state in place of its copy. */
    isLoading?: boolean
    style?: PWViewProps['style']
}

/** What a transaction history shows when it has no rows to list. */
export const TransactionHistoryLoadState = ({
    isLoadFailed,
    isLoadUnavailable,
    isLoadIntegrityBlocked,
    isLoadOffline,
    isRetrying,
    onRetry,
    isSearchPaused,
    onSearchOlder,
    isOfflineEmpty,
    emptyBody,
    isLoading,
    style,
}: TransactionHistoryLoadStateProps) => {
    const { t } = useLanguage()

    const renderEmptyState = () => {
        if (isSearchPaused) {
            return (
                <EmptyView
                    body={t(
                        'asset_details.transaction_list.search_paused_body',
                    )}
                    button={
                        <TransactionHistorySearchOlder
                            onPress={onSearchOlder}
                        />
                    }
                    style={style}
                />
            )
        }
        if (isOfflineEmpty) {
            return (
                <EmptyView
                    title={t(
                        'asset_details.transaction_list.offline_empty_title',
                    )}
                    body={t(
                        'asset_details.transaction_list.offline_empty_body',
                    )}
                    style={style}
                />
            )
        }
        return (
            <EmptyView
                body={
                    emptyBody ?? t('asset_details.transaction_list.empty_body')
                }
                isLoading={isLoading}
                style={style}
            />
        )
    }

    return (
        <OfflineTolerantView
            isOffline={isLoadOffline}
            isUnavailable={isLoadUnavailable}
            isIntegrityBlocked={isLoadIntegrityBlocked}
            isError={isLoadFailed}
            // No retry offline: it can only fail again.
            onRetry={isLoadOffline ? undefined : onRetry}
            isRetrying={isRetrying}
            style={style}
        >
            {renderEmptyState()}
        </OfflineTolerantView>
    )
}
