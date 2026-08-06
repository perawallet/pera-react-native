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

import { PWText, PWView } from '@components/core'
import {
    ConfirmActionContent,
    ConfirmActionLayout,
} from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useWalletConnectErrorContent } from './useWalletConnectErrorContent'

import type { Nullable } from '@perawallet/wallet-core-shared'

export type WalletConnectErrorContentProps = {
    error: Nullable<Error>
    /**
     * Acknowledge handler. Supply it to render outside a bottom sheet — the
     * default host (`ConfirmActionContent`) resolves the sheet it lives in,
     * and its `useBottomSheetResult()` throws where there is no sheet at all,
     * which is the extension's approval page. Mobile omits it and keeps the
     * sheet behaviour unchanged.
     */
    onConfirm?: () => void
    testID?: string
}

export const WalletConnectErrorContent = ({
    error,
    onConfirm,
    testID,
}: WalletConnectErrorContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { errorBody } = useWalletConnectErrorContent(error)

    // One copy composition, two hosts — so the extension's approval page and
    // mobile's sheet cannot drift apart.
    const panel = {
        icon: 'warning',
        iconVariant: 'error',
        title: t('walletconnect.request.error_sheet_title'),
        message: (
            <PWView style={styles.body}>
                <PWText variant='body'>
                    {t('walletconnect.request.error_sheet_body')}
                </PWText>
                <PWText variant='body'>{errorBody}</PWText>
                <PWText variant='body'>
                    {t('walletconnect.request.error_sheet_retry')}
                </PWText>
            </PWView>
        ),
        confirmLabel: t('common.ok.label'),
        confirmVariant: 'secondary',
        testID,
    } as const

    if (onConfirm) {
        return (
            <ConfirmActionLayout
                {...panel}
                onConfirm={onConfirm}
                // Only the confirm button is rendered (no cancelLabel), so
                // this is never reachable — required by the layout's props.
                onCancel={onConfirm}
            />
        )
    }

    return <ConfirmActionContent {...panel} />
}
