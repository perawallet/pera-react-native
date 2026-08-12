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

import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { type WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'
import { getPreferredDappIcon } from '../../utils/dapp-icon'
import { useConnectionSuccessContent } from './useConnectionSuccessContent'

export type ConnectionSuccessContentProps = {
    request: WalletConnectSessionRequest
}

export const ConnectionSuccessContent = ({
    request,
}: ConnectionSuccessContentProps) => {
    const { t } = useLanguage()
    const { dAppName, showReturnCta, returnLabel, handleReturnToDapp } =
        useConnectionSuccessContent(request)

    return (
        <ConfirmActionContent
            testID='wc_connection_success'
            icon='check'
            iconVariant='primary'
            iconUrl={getPreferredDappIcon(request.peerMeta.icons)}
            title={t('walletconnect.request.success_sheet_title', {
                name: dAppName,
            })}
            message={t('walletconnect.request.success_sheet_body', {
                name: dAppName,
            })}
            isMessageCentered
            {...(showReturnCta
                ? {
                      confirmLabel: returnLabel,
                      confirmVariant: 'primary' as const,
                      onConfirm: handleReturnToDapp,
                      confirmTestID: 'wc_connection_success_return',
                      cancelLabel: t('common.close.label'),
                  }
                : {
                      confirmLabel: t('common.close.label'),
                      confirmVariant: 'secondary' as const,
                  })}
        />
    )
}
