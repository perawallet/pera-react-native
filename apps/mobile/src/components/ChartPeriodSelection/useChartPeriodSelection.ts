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

import { useCallback, useState } from 'react'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

type UseChartPeriodSelectionParams = {
    value: HistoryPeriod
    onChange: (val: HistoryPeriod) => void
}

type UseChartPeriodSelectionResult = {
    activeValue: HistoryPeriod
    handlePressed: (newValue: HistoryPeriod) => void
    t: (key: string) => string
}

export const useChartPeriodSelection = ({
    value,
    onChange,
}: UseChartPeriodSelectionParams): UseChartPeriodSelectionResult => {
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

    return {
        activeValue,
        handlePressed,
        t,
    }
}
