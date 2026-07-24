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

import React from 'react'
import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CardCreateStepRow } from './CardCreateStepRow'
import { useCardCreateSigningScreen } from './useCardCreateSigningScreen'
import { useStyles } from './styles'

const STEP_LABEL_KEYS = {
    sign: 'peraCard.signing.step_sign_label',
    create: 'peraCard.signing.step_create_label',
    authorize: 'peraCard.signing.step_authorize_label',
} as const

export const CardCreateSigningScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { steps, isProceeding, onProceed } = useCardCreateSigningScreen()

    return (
        <PWScreen testID='card-create-signing'>
            <PWView style={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('peraCard.signing.title')}
                </PWText>
                <PWText
                    variant='h3'
                    weight={400}
                    style={styles.body}
                >
                    {t('peraCard.signing.body')}
                </PWText>

                <PWView style={styles.steps}>
                    {steps.map(step => (
                        <CardCreateStepRow
                            key={step.id}
                            stepNumber={step.stepNumber}
                            label={t(STEP_LABEL_KEYS[step.id])}
                            status={step.status}
                            testID={`card-create-signing-step-${step.id}`}
                        />
                    ))}
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.signing.proceed_button')}
                    onPress={onProceed}
                    isLoading={isProceeding}
                    style={styles.proceedButton}
                    testID='card-create-signing-proceed'
                />
            </PWView>
        </PWScreen>
    )
}
