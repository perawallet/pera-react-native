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
import {
    PWButton,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWView,
} from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type QuantumPassphraseDetectedContentResult = 'import-quantum'

export type QuantumPassphraseDetectedContentProps = {
    address: string
    isQuantumImportAvailable: boolean
}

export const QuantumPassphraseDetectedContent = ({
    address,
    isQuantumImportAvailable,
}: QuantumPassphraseDetectedContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve, dismiss } =
        useBottomSheetResult<QuantumPassphraseDetectedContentResult>()
    const testID = 'quantum_passphrase_detected_sheet'

    return (
        <PWSheetLayout
            testID={testID}
            header={
                <SheetHeader
                    title={t(
                        'onboarding.import_account.quantum_detected.title',
                    )}
                />
            }
            footer={
                <PWView style={styles.actions}>
                    {isQuantumImportAvailable && (
                        <PWButton
                            variant='primary'
                            title={t(
                                'onboarding.import_account.quantum_detected.import_button',
                            )}
                            onPress={() => resolve('import-quantum')}
                            testID={`${testID}_import_quantum`}
                        />
                    )}
                    <PWButton
                        variant='secondary'
                        title={t(
                            isQuantumImportAvailable
                                ? 'common.cancel.label'
                                : 'common.go_back.label',
                        )}
                        onPress={dismiss}
                        testID={`${testID}_back`}
                    />
                </PWView>
            }
        >
            <PWView style={styles.body}>
                <PWIcon
                    name='quantum'
                    size='xxl'
                    style={styles.icon}
                />
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t(
                        isQuantumImportAvailable
                            ? 'onboarding.import_account.quantum_detected.body'
                            : 'onboarding.import_account.quantum_detected.body_unavailable',
                    )}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.address}
                    testID={`${testID}_address`}
                >
                    {address}
                </PWText>
            </PWView>
        </PWSheetLayout>
    )
}
