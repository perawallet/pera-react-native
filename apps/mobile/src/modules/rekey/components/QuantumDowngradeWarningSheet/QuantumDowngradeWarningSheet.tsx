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

import { Trans } from 'react-i18next'
import { PWText } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'

export type QuantumDowngradeWarningSheetProps = {
    sourceName: string
    targetName: string
    testID?: string
}

export const QuantumDowngradeWarningSheet = ({
    sourceName,
    targetName,
    testID = 'quantum-downgrade-warning-sheet',
}: QuantumDowngradeWarningSheetProps) => {
    const { t } = useLanguage()
    return (
        <ConfirmActionContent
            icon='warning'
            iconVariant='error'
            title={t('rekey.quantum_downgrade_warning.title')}
            message={
                <PWText variant='body'>
                    <Trans
                        i18nKey='rekey.quantum_downgrade_warning.body'
                        values={{
                            source: sourceName,
                            target: targetName,
                        }}
                        components={[
                            <PWText
                                key='source'
                                variant='bodySemibold'
                            />,
                            <PWText
                                key='target'
                                variant='bodySemibold'
                            />,
                        ]}
                    />
                </PWText>
            }
            confirmLabel={t('rekey.quantum_downgrade_warning.confirm')}
            cancelLabel={t('rekey.quantum_downgrade_warning.cancel')}
            confirmVariant='destructive'
            testID={testID}
        />
    )
}
