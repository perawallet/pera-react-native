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

import { ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { PWButton, PWScreen, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import { useTermsAndConditionsSheet } from './useTermsAndConditionsSheet'
import { useStyles } from './styles'

/**
 * Blocking Terms & Conditions gate. Renders the terms inline — from the copy
 * bundled with the app when it matches the required version (no spinner), or the
 * remote URL when the version was bumped. The "I Agree" action is pinned to the
 * bottom and stays disabled until the user scrolls to the end. No close
 * affordance in the header; the host controls drag/backdrop dismissal.
 */
export const TermsAndConditionsSheet = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        source,
        showLoading,
        injectedJavaScript,
        onMessage,
        isAgreeDisabled,
        onAgree,
    } = useTermsAndConditionsSheet()

    return (
        <PWScreen
            scroll='never'
            horizontalPadding='none'
            header={
                <SheetHeader
                    title={t('onboarding.terms_sheet.title')}
                    showClose={false}
                />
            }
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('onboarding.terms_sheet.agree')}
                        onPress={onAgree}
                        isDisabled={isAgreeDisabled}
                        testID='terms_agree_button'
                    />
                </PWView>
            }
        >
            <WebView
                source={source}
                style={styles.webView}
                injectedJavaScript={injectedJavaScript}
                onMessage={onMessage}
                startInLoadingState={showLoading}
                renderLoading={
                    showLoading ? () => <ActivityIndicator /> : undefined
                }
            />
        </PWScreen>
    )
}
