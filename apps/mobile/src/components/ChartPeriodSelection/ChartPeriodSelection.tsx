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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'
import {
    HISTORY_PERIODS,
    type HistoryPeriod,
} from '@perawallet/wallet-core-shared'
import { useChartPeriodSelection } from './useChartPeriodSelection'

export type ChartPeriodSelectionProps = {
    value: HistoryPeriod
    onChange: (val: HistoryPeriod) => void
}

// Record keeps this exhaustive — adding a HistoryPeriod without a label
// fails to compile.
const PERIOD_LABELS: Record<HistoryPeriod, string> = {
    'one-day': 'chart.one_day.label',
    'one-week': 'chart.one_week.label',
    'one-month': 'chart.one_month.label',
    'one-year': 'chart.one_year.label',
}

const PERIODS = HISTORY_PERIODS.map(value => ({
    value,
    label: PERIOD_LABELS[value],
}))

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
                            truncate
                        >
                            {t(label)}
                        </PWText>
                    </PWTouchableOpacity>
                )
            })}
        </PWView>
    )
}
