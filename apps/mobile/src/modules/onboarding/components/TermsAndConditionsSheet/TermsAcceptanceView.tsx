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

import {
    PWButton,
    PWScreen,
    PWStaticWebView,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useTermsAcceptanceView } from './useTermsAcceptanceView'
import { useStyles } from './styles'

type TermsAcceptanceViewProps = {
    /** Invoked after acceptance is recorded — the presenter closes/resolves. */
    onAccepted: () => void
    /** Header title. Defaults to the standard "Terms and Conditions" copy. */
    title?: string
}

/**
 * Presentation-agnostic Terms & Conditions view: terms rendered inline (bundled
 * copy when it matches the required version, else the remote URL), with an
 * "I Agree" action pinned to the bottom. No close affordance — the presenter
 * (bottom sheet or prompt) owns dismissal. Used both by `TermsAndConditionsSheet`
 * (welcome screen) and `TermsAcceptancePrompt` (already-onboarded re-acceptance).
 */
export const TermsAcceptanceView = ({
    onAccepted,
    title,
}: TermsAcceptanceViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { source, showLoading, onAgree } = useTermsAcceptanceView(onAccepted)

    return (
        <PWScreen
            scroll='never'
            horizontalPadding='none'
            header={
                <PWToolbar
                    paddingStyle='dense'
                    center={
                        <PWText
                            variant='h4'
                            truncate
                        >
                            {title ?? t('onboarding.terms_sheet.title')}
                        </PWText>
                    }
                />
            }
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('onboarding.terms_sheet.agree')}
                        onPress={onAgree}
                        testID='terms_agree_button'
                    />
                </PWView>
            }
        >
            <PWStaticWebView
                source={source}
                startInLoadingState={showLoading}
            />
        </PWScreen>
    )
}
