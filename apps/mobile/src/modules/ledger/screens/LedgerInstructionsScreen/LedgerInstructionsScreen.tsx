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
import { ScreenHeader } from '@components/ScreenHeader'

import { useStyles } from './styles'
import { useLedgerInstructionsScreen } from './useLedgerInstructionsScreen'

const BLE_INSTRUCTIONS = [
    { step: 1, key: 'ledger.instructions.step_1' },
    { step: 2, key: 'ledger.instructions.step_2' },
    { step: 3, key: 'ledger.instructions.step_3' },
] as const

const USB_INSTRUCTIONS = [
    { step: 1, key: 'ledger.instructions.usb.step_1' },
    { step: 2, key: 'ledger.instructions.usb.step_2' },
    { step: 3, key: 'ledger.instructions.usb.step_3' },
] as const

export const LedgerInstructionsScreen = () => {
    const styles = useStyles()
    const { isChecking, transportType, handleContinue, t } =
        useLedgerInstructionsScreen()

    const isUsb = transportType === 'usb'
    const titleKey = isUsb
        ? 'ledger.instructions.usb.title'
        : 'ledger.instructions.title'
    const descriptionKey = isUsb
        ? 'ledger.instructions.usb.description'
        : 'ledger.instructions.description'
    const instructions = isUsb ? USB_INSTRUCTIONS : BLE_INSTRUCTIONS

    return (
        <PWScreen
            scroll='never'
            footer={
                <PWButton
                    testID='ledger_instructions_continue_button'
                    title={t('ledger.instructions.continue')}
                    onPress={handleContinue}
                    variant='primary'
                    isDisabled={isChecking}
                />
            }
        >
            <ScreenHeader
                testID='ledger_instructions_screen'
                icon='ledger'
                title={t(titleKey)}
                description={t(descriptionKey)}
            />

            <PWView style={styles.instructionsList}>
                {instructions.map(({ step, key }) => (
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
        </PWScreen>
    )
}
