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

import { Text } from '@rneui/themed'
import PWView from '../PWView/PWView'
import { useStyles } from './styles'
import { useCallback, useState } from 'react'
import PWTouchableOpacity from '../PWTouchableOpacity/PWTouchableOpacity'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/language'

type ChartPeriodSelectionProps = {
    value: HistoryPeriod
    onChange: (val: HistoryPeriod) => void
}

const ChartPeriodSelection = ({
    value,
    onChange,
}: ChartPeriodSelectionProps) => {
    const styles = useStyles()
    const [activeValue, setActiveValue] = useState<HistoryPeriod>(value)
    const { t } = useLanguage()

    const handlePressed = useCallback(
        (newValue: HistoryPeriod) => {
            if (activeValue !== newValue) {
                setActiveValue(newValue)
                onChange(newValue)
            }
        },
        [onChange, setActiveValue, activeValue],
    )

    return (
        <PWView style={styles.container}>
            <PWTouchableOpacity
                onPress={() => handlePressed('one-week')}
                style={
                    activeValue === 'one-week'
                        ? styles.selectedButtonContainer
                        : styles.unselectedButtonContainer
                }
            >
                <Text>{t('chart.one_week.label')}</Text>
            </PWTouchableOpacity>
            <PWTouchableOpacity
                onPress={() => handlePressed('one-month')}
                style={
                    activeValue === 'one-month'
                        ? styles.selectedButtonContainer
                        : styles.unselectedButtonContainer
                }
            >
                <Text>{t('chart.one_month.label')}</Text>
            </PWTouchableOpacity>
            <PWTouchableOpacity
                onPress={() => handlePressed('one-year')}
                style={
                    activeValue === 'one-year'
                        ? styles.selectedButtonContainer
                        : styles.unselectedButtonContainer
                }
            >
                <Text>{t('chart.one_year.label')}</Text>
            </PWTouchableOpacity>
        </PWView>
    )
}

export default ChartPeriodSelection
