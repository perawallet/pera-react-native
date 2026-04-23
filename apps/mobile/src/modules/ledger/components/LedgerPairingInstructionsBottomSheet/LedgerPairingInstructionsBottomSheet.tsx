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
import { PWBottomSheet, PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type LedgerPairingInstructionsBottomSheetProps = {
    isVisible: boolean
    onContinue: () => void
    onCancel: () => void
}

const STEP_KEYS = [
    'ledger.pairing_instructions.step_1',
    'ledger.pairing_instructions.step_2',
    'ledger.pairing_instructions.step_3',
    'ledger.pairing_instructions.step_4',
] as const

export const LedgerPairingInstructionsBottomSheet = ({
    isVisible,
    onContinue,
    onCancel,
}: LedgerPairingInstructionsBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onDismiss={onCancel}
        >
            <PWView style={styles.container}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('ledger.pairing_instructions.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.subtitle}
                >
                    {t('ledger.pairing_instructions.subtitle')}
                </PWText>

                <PWView style={styles.list}>
                    {STEP_KEYS.map((key, index) => (
                        <PWView
                            key={key}
                            style={styles.listItem}
                        >
                            <PWView style={styles.stepCircle}>
                                <PWText
                                    variant='body'
                                    style={styles.stepNumber}
                                >
                                    {String(index + 1)}
                                </PWText>
                            </PWView>
                            <PWText
                                variant='body'
                                style={styles.listItemText}
                            >
                                {t(key)}
                            </PWText>
                        </PWView>
                    ))}
                </PWView>

                <PWButton
                    variant='secondary'
                    title={t('ledger.pairing_instructions.continue')}
                    onPress={onContinue}
                    testID='ledger_pairing_instructions_continue_button'
                />
            </PWView>
        </PWBottomSheet>
    )
}
