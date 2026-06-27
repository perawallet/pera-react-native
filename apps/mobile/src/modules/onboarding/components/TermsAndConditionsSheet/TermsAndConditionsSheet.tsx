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

import { useCallback } from 'react'
import { ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { config } from '@perawallet/wallet-core-config'
import { PWButton, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useTermsAcceptance } from '../../hooks/useTermsAcceptance'
import { useStyles } from './styles'

/**
 * Blocking Terms & Conditions gate shown on launch when the user hasn't accepted
 * the current `terms_version`. Renders the terms inline from the configured URL
 * and offers a single "I Agree" action that records acceptance and closes. It is
 * intentionally non-dismissable (no close affordance, no pan-to-close) — the
 * host opens it with those options off.
 */
export const TermsAndConditionsSheet = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<boolean>()
    const { acceptCurrentTerms } = useTermsAcceptance()

    const handleAgree = useCallback(() => {
        acceptCurrentTerms()
        resolve(true)
    }, [acceptCurrentTerms, resolve])

    return (
        <SafeAreaView
            edges={['bottom']}
            style={styles.container}
        >
            <SheetHeader title={t('onboarding.terms_sheet.title')} />
            <PWView style={styles.webViewContainer}>
                <WebView
                    source={{ uri: config.termsOfServiceUrl }}
                    style={styles.webView}
                    startInLoadingState
                    renderLoading={() => <ActivityIndicator />}
                />
            </PWView>
            <PWView style={styles.footer}>
                <PWButton
                    variant='primary'
                    title={t('onboarding.terms_sheet.agree')}
                    onPress={handleAgree}
                    testID='terms_agree_button'
                />
            </PWView>
        </SafeAreaView>
    )
}
