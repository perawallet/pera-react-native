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

import { PWBottomSheet, PWView, PWText, PWIcon } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type LedgerHowItWorksBottomSheetProps = {
    isVisible: boolean
    onDismiss: () => void
}

const STEP_KEYS = [
    'ledger.how_does_it_work.step_1',
    'ledger.how_does_it_work.step_2',
    'ledger.how_does_it_work.step_3',
    'ledger.how_does_it_work.step_4',
] as const

export const LedgerHowItWorksBottomSheet = ({
    isVisible,
    onDismiss,
}: LedgerHowItWorksBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onDismiss={onDismiss}
            enablePanDownToClose={true}
        >
            <PWView style={styles.container}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('ledger.how_does_it_work.title')}
                </PWText>

                <PWView style={styles.list}>
                    {STEP_KEYS.map(key => (
                        <PWView
                            key={key}
                            style={styles.item}
                        >
                            <PWView style={styles.bullet}>
                                <PWIcon
                                    name='check'
                                    size='xs'
                                    variant='positive'
                                />
                            </PWView>
                            <PWText
                                variant='body'
                                style={styles.itemText}
                            >
                                {t(key)}
                            </PWText>
                        </PWView>
                    ))}
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
