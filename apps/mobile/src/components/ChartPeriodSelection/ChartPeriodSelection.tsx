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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useChartPeriodSelection } from './useChartPeriodSelection'

export type ChartPeriodSelectionProps = {
    value: HistoryPeriod
    onChange: (val: HistoryPeriod) => void
}

const PERIODS: { value: HistoryPeriod; label: string }[] = [
    { value: 'one-week', label: 'chart.one_week.label' },
    { value: 'one-month', label: 'chart.one_month.label' },
    { value: 'one-year', label: 'chart.one_year.label' },
]

export const ChartPeriodSelection = ({
    value,
    onChange,
}: ChartPeriodSelectionProps) => {
    const styles = useStyles()
    const { activeValue, handlePressed, t } = useChartPeriodSelection({
        value,
        onChange,
    })

    return (
        <PWView style={styles.container}>
            {PERIODS.map(({ value: periodValue, label }) => {
                const isActive = activeValue === periodValue

                return (
                    <PWTouchableOpacity
                        key={periodValue}
                        onPress={() => handlePressed(periodValue)}
                        style={[
                            styles.buttonBase,
                            isActive
                                ? styles.selectedButtonContainer
                                : styles.unselectedButtonContainer,
                        ]}
                    >
                        <PWText
                            style={
                                isActive
                                    ? styles.selectedText
                                    : styles.unselectedText
                            }
                        >
                            {t(label)}
                        </PWText>
                    </PWTouchableOpacity>
                )
            })}
        </PWView>
    )
}
