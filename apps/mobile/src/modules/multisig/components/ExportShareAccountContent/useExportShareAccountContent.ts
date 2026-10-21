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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { bottomSheetNotifier } from '@components/core'
import { useClipboard } from '@hooks/useClipboard'
import { buildDeeplink, DeeplinkType } from '@modules/deeplink/core'
import { useLanguage } from '@hooks/useLanguage'
import { shareText } from '@utils/shareText'
import { useErrorToast } from '@hooks/useErrorToast'
import {
    trackEvent,
    AccountDetailsEvent,
    AnalyticsMetadataKey,
} from '@analytics'

export type UseExportShareAccountContentParams = {
    accountAddress: string
    chainId: ChainId
}

export type UseExportShareAccountContentResult = {
    exportUrl: string
    handleCopyUrl: () => void
    handleShareUrl: () => Promise<void>
}

export const useExportShareAccountContent = ({
    accountAddress,
    chainId,
}: UseExportShareAccountContentParams): UseExportShareAccountContentResult => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const { copyToClipboard } = useClipboard()

    const exportUrl = useMemo(
        () =>
            buildDeeplink({
                type: DeeplinkType.SHARED_ACCOUNT_IMPORT,
                address: accountAddress,
            }),
        [accountAddress],
    )

    const handleCopyUrl = useCallback(() => {
        trackEvent(AccountDetailsEvent.JointAccountCopyUrl, {
            [AnalyticsMetadataKey.ChainId]: chainId,
        })
        void copyToClipboard(exportUrl)
    }, [chainId, copyToClipboard, exportUrl])

    const handleShareUrl = useCallback(async () => {
        trackEvent(AccountDetailsEvent.JointAccountShareUrl, {
            [AnalyticsMetadataKey.ChainId]: chainId,
        })
        try {
            await shareText({
                title: t('multisig.export.title'),
                message: exportUrl,
            })
        } catch (error) {
            showError(error, t('errors.general.title'), {
                notifier: bottomSheetNotifier.current ?? undefined,
            })
        }
    }, [chainId, exportUrl, showError, t])

    return {
        exportUrl,
        handleCopyUrl,
        handleShareUrl,
    }
}
