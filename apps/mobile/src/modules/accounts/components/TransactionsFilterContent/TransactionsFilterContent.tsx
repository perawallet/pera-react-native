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

import React, { useState } from 'react'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker, {
    type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'

import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { TransactionFilter, type CustomDateRange } from './types'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'

export type TransactionsFilterResult = {
    filter: TransactionFilter
    customRange?: CustomDateRange
}

export type TransactionsFilterContentProps = {
    activeFilter: TransactionFilter
    initialCustomRange?: CustomDateRange
}

export const TransactionsFilterContent = ({
    activeFilter,
    initialCustomRange,
}: TransactionsFilterContentProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
    const { resolve } = useBottomSheetResult<TransactionsFilterResult>()

    // Internal state
    const [view, setView] = useState<'main' | 'custom_range'>('main')

    // Custom range state
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

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-GB').replace(/\//g, '.')
    }

    const getDateRangeSubtitle = (filter: TransactionFilter) => {
        const today = new Date()

        // Helper to format: "MMM DD" or "MMM DD-DD"
        const format = (d: Date) =>
            d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })

        switch (filter) {
            case TransactionFilter.Today: {
                return format(today)
            }
            case TransactionFilter.Yesterday: {
                const y = new Date()
                y.setDate(y.getDate() - 1)
                return format(y)
            }
            case TransactionFilter.LastWeek: {
                const end = new Date()
                // "Last Week" as 7 days ago
                const start = new Date()
                start.setDate(end.getDate() - 6)
                return `${format(start)}–${end.getDate()}` // Simplified
            }
            case TransactionFilter.LastMonth: {
                // "Last Month": Previous calendar month? Or last 30 days?
                // Screenshot says "Jan 01-31" for Feb. So Previous Calendar Month.
                const start = new Date(
                    today.getFullYear(),
                    today.getMonth() - 1,
                    1,
                )
                const end = new Date(today.getFullYear(), today.getMonth(), 0)
                return `${format(start)}–${end.getDate()}`
            }
            default: {
                return ''
            }
        }
    }

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
        if (Platform.OS === 'android') {
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

    const renderMainView = () => (
        <>
            <PWView style={styles.header}>
                <PWView style={styles.headerSpacer} />
                <PWView style={styles.titleContainer}>
                    <PWText
                        variant='h4'
                        style={styles.title}
                        truncate
                    >
                        {t('transactions.filter.title')}
                    </PWText>
                </PWView>
                <PWView style={styles.headerSpacer} />
            </PWView>

            {[
                {
                    id: TransactionFilter.AllTime,
                    icon: 'text-document' as const,
                    title: t('transactions.filter.all_time'),
                },
                {
                    id: TransactionFilter.Today,
                    icon: 'text-document' as const,
                    title: t('transactions.filter.today'),
                },
                {
                    id: TransactionFilter.Yesterday,
                    icon: 'text-document' as const,
                    title: t('transactions.filter.yesterday'),
                },
                {
                    id: TransactionFilter.LastWeek,
                    icon: 'text-document' as const,
                    title: t('transactions.filter.last_week'),
                },
                {
                    id: TransactionFilter.LastMonth,
                    icon: 'text-document' as const,
                    title: t('transactions.filter.last_month'),
                },
                {
                    id: TransactionFilter.CustomRange,
                    icon: 'sliders' as const,
                    title: t('transactions.filter.custom_range'),
                },
            ].map(item => {
                const isSelected = activeFilter === item.id
                const subtitle = getDateRangeSubtitle(item.id)

                return (
                    <PWTouchableOpacity
                        key={item.id}
                        style={styles.listItem}
                        onPress={() => handleFilterPress(item.id)}
                    >
                        <PWIcon
                            name={item.icon}
                            size='md'
                            style={styles.listIcon}
                        />
                        <PWView style={styles.listContent}>
                            <PWText
                                variant='h4'
                                style={styles.listTitle}
                                truncate
                            >
                                {item.title}
                            </PWText>
                            {subtitle ? (
                                <PWText
                                    variant='body'
                                    style={styles.listSubtitle}
                                    truncate
                                >
                                    {subtitle}
                                </PWText>
                            ) : null}
                        </PWView>
                        {isSelected && (
                            <PWView style={styles.checkIcon}>
                                <PWIcon
                                    name='check'
                                    size='md'
                                    variant='positive'
                                />
                            </PWView>
                        )}
                    </PWTouchableOpacity>
                )
            })}

            <PWView style={styles.bottomSpacer} />
        </>
    )

    const renderCustomRangeView = () => (
        <>
            <PWView style={styles.header}>
                <PWTouchableOpacity
                    style={styles.headerAction}
                    onPress={() => setView('main')}
                >
                    <PWIcon name='chevron-left' />
                </PWTouchableOpacity>
                <PWView style={styles.titleContainer}>
                    <PWText
                        variant='h4'
                        style={styles.title}
                        truncate
                    >
                        {t('transactions.filter.custom_range')}
                    </PWText>
                </PWView>
                <PWTouchableOpacity
                    style={styles.headerAction}
                    onPress={handleApplyCustomRange}
                >
                    <PWText
                        variant='h4'
                        style={styles.doneButton}
                        truncate
                    >
                        {t('common.done')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>

            <PWView style={styles.customRangeContainer}>
                <PWView style={styles.dateInputsContainer}>
                    <PWTouchableOpacity
                        style={[
                            styles.dateInputWrapper,
                            activeDateInput === 'from' &&
                                styles.activeDateInput,
                        ]}
                        onPress={() => handleDatePress('from')}
                    >
                        <PWText
                            variant='body'
                            style={styles.dateLabel}
                            truncate
                        >
                            {t('transactions.common.from')}
                        </PWText>
                        <PWText
                            variant='h4'
                            style={styles.dateValue}
                            truncate
                        >
                            {formatDate(customRange.from)}
                        </PWText>
                    </PWTouchableOpacity>
                    <PWTouchableOpacity
                        style={[
                            styles.dateInputWrapper,
                            activeDateInput === 'to' && styles.activeDateInput,
                        ]}
                        onPress={() => handleDatePress('to')}
                    >
                        <PWText
                            variant='body'
                            style={styles.dateLabel}
                            truncate
                        >
                            {t('transactions.common.to')}
                        </PWText>
                        <PWText
                            variant='h4'
                            style={styles.dateValue}
                            truncate
                        >
                            {formatDate(customRange.to)}
                        </PWText>
                    </PWTouchableOpacity>
                </PWView>

                {isPickerVisible && (
                    <DateTimePicker
                        value={
                            activeDateInput === 'from'
                                ? customRange.from
                                : customRange.to
                        }
                        mode='date'
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onValueChange={handleDateValueChange}
                        onDismiss={handlePickerDismiss}
                        themeVariant={isDarkMode ? 'dark' : 'light'}
                    />
                )}
            </PWView>
        </>
    )

    return view === 'main' ? renderMainView() : renderCustomRangeView()
}
