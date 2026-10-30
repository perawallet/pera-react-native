/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { useState } from 'react'
import type { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { isAndroid } from '@utils/platform'
import { TransactionFilter, type CustomDateRange } from './types'

export type TransactionsFilterResult = {
    filter: TransactionFilter
    customRange?: CustomDateRange
}

export type UseTransactionsFilterContentProps = {
    activeFilter: TransactionFilter
    initialCustomRange?: CustomDateRange
}

export type UseTransactionsFilterContentResult = {
    view: 'main' | 'custom_range'
    customRange: CustomDateRange
    activeDateInput: 'from' | 'to'
    isPickerVisible: boolean
    handleFilterPress: (filter: TransactionFilter) => void
    handleDatePress: (input: 'from' | 'to') => void
    handleDateValueChange: (
        event: DateTimePickerChangeEvent,
        date: Date,
    ) => void
    handlePickerDismiss: () => void
    handleApplyCustomRange: () => void
}

export const useTransactionsFilterContent = ({
    activeFilter,
    initialCustomRange,
}: UseTransactionsFilterContentProps): UseTransactionsFilterContentResult => {
    const { resolve } = useBottomSheetResult<TransactionsFilterResult>()

    const [view, setView] = useState<'main' | 'custom_range'>('main')

    const [customRange, setCustomRange] = useState<CustomDateRange>(
        initialCustomRange || {
            from: new Date(),
            to: new Date(),
        },
    )
    const [activeDateInput, setActiveDateInput] = useState<'from' | 'to'>(
        'from',
    )
    const [isPickerVisible, setIsPickerVisible] = useState(false)

    const handleFilterPress = (filter: TransactionFilter) => {
        if (filter === TransactionFilter.CustomRange) {
            setView('custom_range')
        } else {
            resolve({ filter })
        }
    }

    const handleDatePress = (input: 'from' | 'to') => {
        setActiveDateInput(input)
        setIsPickerVisible(true)
    }

    const handleDateValueChange = (
        _event: DateTimePickerChangeEvent,
        date: Date,
    ) => {
        if (isAndroid()) {
            setIsPickerVisible(false)
        }

        setCustomRange(prev => {
            const next = { ...prev, [activeDateInput]: date }
            if (next.from > next.to) {
                if (activeDateInput === 'from') {
                    next.to = date
                } else {
                    next.from = date
                }
            }
            return next
        })
    }

    const handlePickerDismiss = () => {
        setIsPickerVisible(false)
    }

    const handleApplyCustomRange = () => {
        resolve({ filter: TransactionFilter.CustomRange, customRange })
    }

    return {
        view,
        customRange,
        activeDateInput,
        isPickerVisible,
        handleFilterPress,
        handleDatePress,
        handleDateValueChange,
        handlePickerDismiss,
        handleApplyCustomRange,
    }
}
