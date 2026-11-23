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
import {
    toScopeKey,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useChainCapability,
    useChainCapabilityCheck,
    useIsCapabilityRestricted,
} from '@perawallet/wallet-core-chain-shared'
import {
    CSV_MIME_TYPE,
    useCsvExportMutation,
} from '@perawallet/wallet-core-transactions'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import {
    trackEvent,
    AccountDetailsEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { shareFile } from '@utils/shareFile'
import type { HistorySource } from './useAccountHistoryRows'

export type UseAccountHistoryCsvExportParams = {
    scope: ChainScope
    /** One per network the rows can come from; `scope`'s alone off a merged history. */
    sources: HistorySource[]
    isMerged: boolean
    /** `YYYY-MM-DD`, inclusive, UTC. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive, UTC. */
    beforeTime?: string
}

export type UseAccountHistoryCsvExportResult = {
    handleExportCsv: () => void
    isExportingCsv: boolean
    isCsvExportVisible: boolean
    csvExportTitle: string
}

const CHAIN_SELECTION_SHEET_OPTIONS = {
    size: 'auto',
    enablePanDownToClose: true,
    autoCreateContainer: false,
} as const

export const useAccountHistoryCsvExport = ({
    scope,
    sources,
    isMerged,
    afterTime,
    beforeTime,
}: UseAccountHistoryCsvExportParams): UseAccountHistoryCsvExportResult => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const { requestByType } = useBottomSheet()

    const {
        exportCsv,
        isLoading: isExportingCsv,
        isUnavailableOnNetwork,
    } = useCsvExportMutation({
        scope,
        onSuccess: result => {
            void (async () => {
                try {
                    await shareFile(result.filename, result.csvContent, {
                        mimeType: CSV_MIME_TYPE,
                    })
                } catch (error) {
                    showError(error, t('errors.general.title'))
                }
            })()
        },
        onError: error => {
            showError(error, t('errors.general.title'))
        },
    })

    // A network is offered once it has rows; counting rows rather than
    // `!isEmpty` also keeps the action hidden through the initial load.
    // A chain whose build has no CSV export hides the action outright; one that
    // only restricts it on this network (BetaNet, custom) keeps it to explain why.
    const hasCsvExport = useChainCapability(scope.chainId, 'csvExport')
    const isCsvExportRestricted = useIsCapabilityRestricted(
        scope.chainId,
        'csvExport',
    )
    // Another network on a merged history is offered only where it can export.
    const hasCapability = useChainCapabilityCheck()
    const scopeKey = toScopeKey(scope)
    // Keyed by a string, since the checker is a new function every render.
    const exportableKeys = sources
        .filter(
            source =>
                source.transactionCount > 0 &&
                (toScopeKey(source.scope) === scopeKey
                    ? hasCsvExport || isCsvExportRestricted
                    : hasCapability({
                          chain: {
                              chainId: source.scope.chainId,
                              capability: 'csvExport',
                          },
                      })),
        )
        .map(source => toScopeKey(source.scope))
        .join()
    const exportable = useMemo(
        () =>
            sources.filter(source =>
                exportableKeys.split(',').includes(toScopeKey(source.scope)),
            ),
        [sources, exportableKeys],
    )
    const isCsvExportVisible = exportable.length > 0
    // Export is per network, so on a merged history the action names the one
    // it covers, or asks which when several have rows.
    const csvExportTitle =
        isMerged && exportable.length === 1
            ? t('asset_details.transaction_list.csv_on_network', {
                  network:
                      chainDisplayNameOf(exportable[0].scope.chainId) ??
                      exportable[0].scope.chainId,
              })
            : t('asset_details.transaction_list.csv')

    const isPeriodSelected = afterTime !== undefined || beforeTime !== undefined

    const exportFrom = useCallback(
        (source: HistorySource) => {
            const isOwnScope = toScopeKey(source.scope) === scopeKey
            trackEvent(AccountDetailsEvent.TransactionDownload, {
                [AnalyticsMetadataKey.ChainId]: source.scope.chainId,
            })
            // Guarding the request would silence its central toast too, so
            // the reason has to be raised here or the button would do nothing.
            if (isOwnScope && isUnavailableOnNetwork) {
                showError(
                    new PeraServiceUnavailableError(scope),
                    t('common.network_unavailable.title'),
                )
                return
            }
            exportCsv({
                accountAddress: source.address,
                ...(!isOwnScope && { scope: source.scope }),
                ...(isPeriodSelected && {
                    dateRange: { startDate: afterTime, endDate: beforeTime },
                }),
            })
        },
        [
            afterTime,
            beforeTime,
            exportCsv,
            isPeriodSelected,
            isUnavailableOnNetwork,
            scope,
            scopeKey,
            showError,
            t,
        ],
    )

    const handleExportCsv = useCallback(() => {
        if (exportable.length <= 1) {
            if (exportable[0]) exportFrom(exportable[0])
            return
        }
        void requestByType<'deeplink-chain-selection', ChainId>(
            'deeplink-chain-selection',
            {
                chainIds: exportable.map(source => source.scope.chainId),
                title: t('chain_selection.title'),
            },
            CHAIN_SELECTION_SHEET_OPTIONS,
        ).then(chainId => {
            const picked =
                chainId &&
                new Map(
                    exportable.map(source => [source.scope.chainId, source]),
                ).get(chainId)
            if (picked) exportFrom(picked)
        })
    }, [exportable, exportFrom, requestByType, t])

    return {
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        csvExportTitle,
    }
}
