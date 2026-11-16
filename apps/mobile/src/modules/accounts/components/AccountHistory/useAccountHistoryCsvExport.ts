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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapability,
    useIsCapabilityRestricted,
} from '@perawallet/wallet-core-chain-shared'
import {
    CSV_MIME_TYPE,
    useCsvExportMutation,
} from '@perawallet/wallet-core-transactions'
import {
    PeraServiceUnavailableError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    trackEvent,
    AccountDetailsEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { shareFile } from '@utils/shareFile'

export type UseAccountHistoryCsvExportParams = {
    scope: ChainScope
    accountAddress: Optional<string>
    transactionCount: number
    isMerged: boolean
}

export type UseAccountHistoryCsvExportResult = {
    handleExportCsv: () => void
    isExportingCsv: boolean
    isCsvExportVisible: boolean
}

export const useAccountHistoryCsvExport = ({
    scope,
    accountAddress,
    transactionCount,
    isMerged,
}: UseAccountHistoryCsvExportParams): UseAccountHistoryCsvExportResult => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()

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

    const handleExportCsv = useCallback(() => {
        trackEvent(AccountDetailsEvent.TransactionDownload, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        // Guarding the request would silence's central toast too, so
        // the reason has to be raised here or the button would do nothing.
        if (isUnavailableOnNetwork) {
            showError(
                new PeraServiceUnavailableError(scope),
                t('common.network_unavailable.title'),
            )
            return
        }
        if (accountAddress) {
            exportCsv({ accountAddress })
        }
    }, [accountAddress, exportCsv, isUnavailableOnNetwork, scope, showError, t])

    // The Pera export-history endpoint returns 404 for an empty history, so
    // the action waits for rows; `transactionCount > 0` rather than `!isEmpty`
    // also keeps it hidden through the initial load instead of flickering.
    // A chain whose build has no CSV export hides the action outright; one that
    // only restricts it on this network (BetaNet, custom) keeps it to explain why.
    const hasCsvExport = useChainCapability(scope.chainId, 'csvExport')
    const isCsvExportRestricted = useIsCapabilityRestricted(
        scope.chainId,
        'csvExport',
    )
    // Export is per network: on a merged history it would cover only one of them.
    const isCsvExportVisible =
        !isMerged &&
        transactionCount > 0 &&
        (hasCsvExport || isCsvExportRestricted)

    return { handleExportCsv, isExportingCsv, isCsvExportVisible }
}
