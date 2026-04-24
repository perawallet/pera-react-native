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

import React from 'react'
import { PWView, PWText, PWButton, PWIcon } from '@components/core'

import { useStyles } from './styles'
import { useLedgerInstructionsScreen } from './useLedgerInstructionsScreen'

const INSTRUCTIONS = [
    { step: 1, key: 'ledger.instructions.step_1' },
    { step: 2, key: 'ledger.instructions.step_2' },
    { step: 3, key: 'ledger.instructions.step_3' },
] as const

export const LedgerInstructionsScreen = () => {
    const styles = useStyles()
    const { isChecking, handleContinue, t } = useLedgerInstructionsScreen()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name='wallet'
                        size='xxl'
                    />
                </PWView>

                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('ledger.instructions.title')}
                </PWText>

                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('ledger.instructions.description')}
                </PWText>

                <PWView style={styles.instructionsList}>
                    {INSTRUCTIONS.map(({ step, key }) => (
                        <PWView
                            key={step}
                            style={styles.instructionItem}
                        >
                            <PWView style={styles.stepCircle}>
                                <PWText variant='bodySemibold'>
                                    {String(step)}
                                </PWText>
                            </PWView>
                            <PWText
                                variant='body'
                                style={styles.instructionText}
                            >
                                {t(key)}
                            </PWText>
                        </PWView>
                    ))}
                </PWView>
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    testID='ledger_instructions_continue_button'
                    title={t('ledger.instructions.continue')}
                    onPress={handleContinue}
                    variant='primary'
                    isDisabled={isChecking}
                />
            </PWView>
        </PWView>
    )
}
