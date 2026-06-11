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

import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import {
    useCardOnboardingVerificationScreen,
    VerificationPhase,
} from './useCardOnboardingVerificationScreen'
import { useStyles } from './styles'

// Each phase drives the copy and the single CTA. `start` handlers begin/retry
// verification; `done` handlers leave onboarding from a terminal state.
const PHASE_CONTENT: Record<
    VerificationPhase,
    {
        titleKey: string
        bodyKey: string
        buttonKey: string
        action: 'start' | 'done'
        showSpinner: boolean
    }
> = {
    [VerificationPhase.Idle]: {
        titleKey: 'peraCard.verification.title',
        bodyKey: 'peraCard.verification.body',
        buttonKey: 'peraCard.verification.start_button',
        action: 'start',
        showSpinner: false,
    },
    [VerificationPhase.Starting]: {
        titleKey: 'peraCard.verification.title',
        bodyKey: 'peraCard.verification.body',
        buttonKey: 'peraCard.verification.start_button',
        action: 'start',
        showSpinner: false,
    },
    [VerificationPhase.InProgress]: {
        titleKey: 'peraCard.verification.processing_title',
        bodyKey: 'peraCard.verification.processing_body',
        buttonKey: 'peraCard.verification.continue_button',
        action: 'start',
        showSpinner: true,
    },
    [VerificationPhase.Submitted]: {
        titleKey: 'peraCard.verification.submitted_title',
        bodyKey: 'peraCard.verification.submitted_body',
        buttonKey: 'peraCard.verification.done_button',
        action: 'done',
        showSpinner: false,
    },
    [VerificationPhase.Verified]: {
        titleKey: 'peraCard.verification.success_title',
        bodyKey: 'peraCard.verification.success_body',
        buttonKey: 'peraCard.verification.done_button',
        action: 'done',
        showSpinner: false,
    },
    [VerificationPhase.Rejected]: {
        titleKey: 'peraCard.verification.rejected_title',
        bodyKey: 'peraCard.verification.rejected_body',
        buttonKey: 'peraCard.verification.done_button',
        action: 'done',
        showSpinner: false,
    },
    [VerificationPhase.Error]: {
        titleKey: 'peraCard.verification.error_title',
        bodyKey: 'peraCard.verification.error_body',
        buttonKey: 'peraCard.verification.retry_button',
        action: 'start',
        showSpinner: false,
    },
}

export const CardOnboardingVerificationScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { phase, isBusy, handleStartVerification, handleDone } =
        useCardOnboardingVerificationScreen()

    const content = PHASE_CONTENT[phase]
    const onPress =
        content.action === 'start' ? handleStartVerification : handleDone

    return (
        <PWScreen
            testID='card-onboarding-verification'
            footer={
                <PWButton
                    variant='primary'
                    title={t(content.buttonKey)}
                    onPress={onPress}
                    isDisabled={isBusy}
                    isLoading={isBusy}
                    testID='card-onboarding-verification-cta'
                />
            }
        >
            <PWView style={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t(content.titleKey)}
                </PWText>
                <PWText
                    variant='bodyLarge'
                    weight={400}
                    style={styles.body}
                >
                    {t(content.bodyKey)}
                </PWText>
                {content.showSpinner ? (
                    <LoadingView
                        variant='circle'
                        size='sm'
                        style={styles.spinner}
                    />
                ) : null}
            </PWView>
        </PWScreen>
    )
}
