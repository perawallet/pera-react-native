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
import { ParticipantCount } from '@components/ParticipantCount'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { ThresholdStepper } from '../../components/ThresholdStepper'
import { useSetThresholdScreen } from './useSetThresholdScreen'
import { useStyles } from './styles'

export const SetThresholdScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        threshold,
        participantCount,
        handleIncrement,
        handleDecrement,
        handleContinue,
    } = useSetThresholdScreen()

    return (
        <PWScreen
            scroll='never'
            body={
                <>
                    <ScreenHeader
                        title={t('multisig.threshold.title')}
                        description={t('multisig.threshold.description')}
                    />

                    <PWView style={styles.summaryContainer}>
                        <PWView style={styles.row}>
                            <PWText
                                variant='body'
                                style={styles.label}
                            >
                                {t('multisig.threshold.number_of_accounts')}
                            </PWText>
                            <PWView style={styles.countGroup}>
                                <ParticipantCount
                                    count={participantCount}
                                    size='h1'
                                    testID='participant_count_value'
                                />
                                {/* Aligns the count value under the stepper's value
                                    column by reserving the width of the + button. */}
                                <PWView style={styles.buttonSpacer} />
                            </PWView>
                        </PWView>

                        <PWView style={styles.row}>
                            <PWText
                                variant='body'
                                style={styles.label}
                            >
                                {t('multisig.threshold.required_signatures')}
                            </PWText>
                            <ThresholdStepper
                                value={threshold}
                                min={1}
                                max={participantCount}
                                onIncrement={handleIncrement}
                                onDecrement={handleDecrement}
                            />
                        </PWView>
                    </PWView>
                </>
            }
            footer={
                <PWButton
                    variant='primary'
                    title={t('common.continue.label')}
                    onPress={handleContinue}
                    testID='set_threshold_continue_button'
                />
            }
        />
    )
}
