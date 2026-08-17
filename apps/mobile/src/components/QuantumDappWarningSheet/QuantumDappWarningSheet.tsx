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

import { Trans } from 'react-i18next'
import { config } from '@perawallet/wallet-core-config'
import { PWText } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'

export type QuantumDappWarningDecision = 'continue' | 'cancel'

/**
 * Cancel is destructive here — it rejects the dApp outright — so backdrop
 * press and pan-down are disabled by the caller. Continue and Cancel are the
 * only two exits, which is why this resolves a closed union rather than the
 * boolean `ConfirmActionContent` defaults to.
 */
export const QuantumDappWarningSheet = () => {
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const handleLearnMore = () =>
        // TODO(PQ): point at the dedicated Quantum accounts support page once
        // it exists; accountTypeSupportUrl is the closest placeholder.
        pushWebView({
            url: config.accountTypeSupportUrl,
            id: 'quantum-account-support',
        })

    return (
        <ConfirmActionContent<QuantumDappWarningDecision>
            icon='warning'
            iconVariant='error'
            title={t('quantum.dapp_warning.title')}
            message={
                <PWText variant='body'>
                    <Trans
                        i18nKey='quantum.dapp_warning.body'
                        components={[
                            <PWText
                                key='learn-more'
                                variant='link'
                                onPress={handleLearnMore}
                            />,
                        ]}
                    />
                </PWText>
            }
            confirmLabel={t('quantum.dapp_warning.confirm')}
            cancelLabel={t('quantum.dapp_warning.cancel')}
            confirmValue='continue'
            testID='quantum-dapp-warning-sheet'
        />
    )
}
