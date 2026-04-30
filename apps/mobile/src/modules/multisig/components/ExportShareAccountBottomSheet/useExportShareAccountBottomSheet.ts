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

import { useCallback, useMemo } from 'react'
import { bottomSheetNotifier } from '@components/core'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { shareText } from '@utils/shareText'
import { config } from '@perawallet/wallet-core-config'

export type UseExportShareAccountBottomSheetParams = {
    accountAddress: string
}

export type UseExportShareAccountBottomSheetResult = {
    exportUrl: string
    handleCopyUrl: () => void
    handleShareUrl: () => Promise<void>
}

export const useExportShareAccountBottomSheet = ({
    accountAddress,
}: UseExportShareAccountBottomSheetParams): UseExportShareAccountBottomSheetResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { copyToClipboard } = useClipboard()

    const exportUrl = useMemo(() => {
        const encodedAddress = encodeURIComponent(accountAddress)
        return `perawallet://app/joint-account-import/?address=${encodedAddress}`
    }, [accountAddress])

    const handleCopyUrl = useCallback(() => {
        copyToClipboard(exportUrl)
    }, [copyToClipboard, exportUrl])

    const handleShareUrl = useCallback(async () => {
        try {
            await shareText({
                title: t('multisig.export.title'),
                message: exportUrl,
            })
        } catch (error) {
            showToast(
                {
                    title: t('errors.general.title'),
                    body: config.debugEnabled
                        ? `${error}`
                        : t('errors.general.body'),
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
        }
    }, [exportUrl, showToast, t])

    return {
        exportUrl,
        handleCopyUrl,
        handleShareUrl,
    }
}
