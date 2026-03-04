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

import { PWBottomSheet, PWButton, PWIcon, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './styles'

type ConnectionSuccessBottomSheetProps = {
    onClose: () => void
    request: WalletConnectSessionRequest | null
}

export const ConnectionSuccessBottomSheet = ({
    onClose,
    request,
}: ConnectionSuccessBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const dAppName = request?.peerMeta.name ?? ''

    return (
        <PWBottomSheet
            isVisible={!!request}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
        >
            <PWIcon
                name='check'
                variant='primary'
                size='xl'
                style={styles.icon}
            />
            <PWText variant='h3'>
                {t('walletconnect.request.success_sheet_title', {
                    name: dAppName,
                })}
            </PWText>
            <PWText style={styles.message}>
                {t('walletconnect.request.success_sheet_body', {
                    name: dAppName,
                })}
            </PWText>
            <PWButton
                variant='secondary'
                title={t('common.close.label')}
                onPress={onClose}
            />
        </PWBottomSheet>
    )
}
