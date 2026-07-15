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
import { Trans } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PWButton, PWText, PWView } from '@components/core'
import { trackEvent, OnrampEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { useStyles } from './styles'

// External provider links are not in config; hardcoded for now.
const EXODUS_TERMS_URL = 'https://exodus.com/terms'
const EXODUS_PRIVACY_URL = 'https://exodus.com/privacy'

export const OnrampTermsContent = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<boolean>()
    const { pushWebView } = useWebView()

    const handleOpenLink = useCallback(
        (url: string) => {
            pushWebView({ url })
        },
        [pushWebView],
    )

    const handleAccept = useCallback(() => {
        trackEvent(OnrampEvent.TosAccept)
        resolve(true)
    }, [resolve])

    return (
        <SafeAreaView edges={['bottom']}>
            <SheetHeader
                title={t('onramp.terms.title')}
                showClose
            />
            <PWView style={styles.body}>
                <PWText
                    variant='caption'
                    style={styles.updated}
                >
                    {t('onramp.terms.updated')}
                </PWText>

                <PWText
                    variant='body'
                    style={styles.paragraph}
                >
                    {t('onramp.terms.body')}
                </PWText>

                <PWText variant='body'>
                    <Trans
                        i18nKey='onramp.terms.agreement'
                        components={[
                            <PWText
                                key='exodus-terms'
                                variant='link'
                                onPress={() => handleOpenLink(EXODUS_TERMS_URL)}
                            />,
                            <PWText
                                key='exodus-privacy'
                                variant='link'
                                onPress={() =>
                                    handleOpenLink(EXODUS_PRIVACY_URL)
                                }
                            />,
                            <PWText
                                key='pera-terms'
                                variant='link'
                                onPress={() =>
                                    handleOpenLink(config.termsOfServiceUrl)
                                }
                            />,
                        ]}
                    />
                </PWText>

                <PWButton
                    variant='primary'
                    title={t('onramp.terms.accept')}
                    onPress={handleAccept}
                    testID='onramp-terms-accept'
                />
            </PWView>
        </SafeAreaView>
    )
}
