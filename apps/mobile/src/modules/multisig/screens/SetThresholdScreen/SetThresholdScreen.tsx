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

import { PWButton, PWText, PWView } from '@components/core'
import { ParticipantCount } from '@components/ParticipantCount'
import { useLanguage } from '@hooks/useLanguage'
import { ThresholdStepper } from '../../components/ThresholdStepper'
import { useSetThresholdScreen } from './useSetThresholdScreen'
import { useStyles } from './styles'
import { KeyValueRow } from '@components/KeyValueRow'
import { useMemo } from 'react'
import { TypographyVariant } from '@theme/typography'

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

    const keyValueTitleProps = useMemo(() => {
        return {
            variant: 'body' as TypographyVariant,
            style: styles.keyValueLabel,
        }
    }, [styles])

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                <PWView style={styles.headerContainer}>
                    <PWText variant='h1'>
                        {t('multisig.threshold.title')}
                    </PWText>
                    <PWText
                        variant='h4'
                        style={styles.description}
                    >
                        {t('multisig.threshold.description')}
                    </PWText>
                </PWView>

                <PWView style={styles.summaryContainer}>
                    <KeyValueRow
                        title={t('multisig.threshold.number_of_accounts')}
                        titleProps={keyValueTitleProps}
                    >
                        <PWView style={styles.participantCount}>
                            <ParticipantCount
                                count={participantCount}
                                size='h1'
                            />
                        </PWView>
                    </KeyValueRow>

                    <KeyValueRow
                        title={t('multisig.threshold.required_signatures')}
                        titleProps={keyValueTitleProps}
                    >
                        <ThresholdStepper
                            value={threshold}
                            min={1}
                            max={participantCount}
                            onIncrement={handleIncrement}
                            onDecrement={handleDecrement}
                        />
                    </KeyValueRow>
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('common.continue.label')}
                    onPress={handleContinue}
                    style={styles.continueButton}
                    testID='set_threshold_continue_button'
                />
            </PWView>
        </PWView>
    )
}
