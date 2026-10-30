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

import { memo, useMemo } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWButton, PWText, PWView } from '@components/core'
import { ChainNotice } from '@components/ChainNotice'
import { FilterSelection, type FilterOption } from '@components/FilterSelection'
import { ChainLabel } from '@modules/chain-ui/icon'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type AccountHistoryTitleBarProps = {
    /** The network the history is narrowed to; null is All. */
    chainId: Nullable<ChainId>
    /** Empty on a single-network account: its network is labelled instead. */
    chainFilterOptions: FilterOption<Nullable<ChainId>>[]
    onSelectChain: (chainId: Nullable<ChainId>) => void
    /** Networks whose history failed while others' rows show; empty hides the notice. */
    failedNetworkNames: string[]
    onRetryFailed: () => void
    isCsvExportVisible: boolean
    isExportingCsv: boolean
    onOpenFilter: () => void
    onExportCsv: () => void
}

/**
 * Title + filter/export actions for the History tab. Rendered as the populated
 * list's `ListHeaderComponent` and standalone in the loading/empty branches, so
 * the tab keeps its header in every state. Memoized because SectionList hands
 * the header a fresh element on every parent render.
 */
export const AccountHistoryTitleBar = memo(
    ({
        chainId,
        chainFilterOptions,
        onSelectChain,
        failedNetworkNames,
        onRetryFailed,
        isCsvExportVisible,
        isExportingCsv,
        onOpenFilter,
        onExportCsv,
    }: AccountHistoryTitleBarProps) => {
        const styles = useStyles()
        const { t } = useLanguage()
        const failedParams = useMemo(
            () => ({ networks: failedNetworkNames.join(', ') }),
            [failedNetworkNames],
        )
        const retryAction = useMemo(
            () => ({ labelKey: 'common.retry.label', onPress: onRetryFailed }),
            [onRetryFailed],
        )

        return (
            <PWView style={styles.headerContainer}>
                <PWView style={styles.titleBar}>
                    <PWView style={styles.titleBarTitleContainer}>
                        <PWText
                            variant='h4'
                            truncate
                        >
                            {t('asset_details.transaction_list.title')}
                        </PWText>
                    </PWView>
                    <PWView style={styles.titleBarButtonContainer}>
                        <PWButton
                            icon='sliders'
                            title={t('asset_details.transaction_list.filter')}
                            variant='helper'
                            style={styles.transparentButton}
                            paddingStyle='dense'
                            onPress={onOpenFilter}
                        />
                        {isCsvExportVisible && (
                            <PWButton
                                icon='document-download'
                                title={t('asset_details.transaction_list.csv')}
                                variant='helper'
                                paddingStyle='dense'
                                onPress={onExportCsv}
                                isLoading={isExportingCsv}
                            />
                        )}
                    </PWView>
                </PWView>
                {chainFilterOptions.length > 0 ? (
                    <FilterSelection
                        options={chainFilterOptions}
                        selectedValue={chainId}
                        onSelect={onSelectChain}
                        contentContainerStyle={styles.chainFilter}
                        testID='history_network_filter'
                    />
                ) : (
                    chainId !== null && <ChainLabel chainId={chainId} />
                )}
                {failedNetworkNames.length > 0 && (
                    <ChainNotice
                        kind='error'
                        titleKey='asset_details.transaction_list.network_failed'
                        params={failedParams}
                        action={retryAction}
                        style={styles.failedNotice}
                        testID='history_network_failed'
                    />
                )}
            </PWView>
        )
    },
)
