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

import React, { useState } from 'react'
import {
    PWIcon,
    PWText,
    PWButton,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import DateTimePicker, {
    DateTimePickerEvent,
} from '@react-native-community/datetimepicker'

import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { TransactionFilter, CustomDateRange } from './types'
import { useLanguage } from '@hooks/useLanguage'

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
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve, dismiss } =
        useBottomSheetResult<TransactionsFilterResult>()

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

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-GB').replace(/\//g, '.')
    }

    const getDateRangeSubtitle = (filter: TransactionFilter) => {
        const today = new Date()

        // Helper to format: "MMM DD" or "MMM DD-DD"
        const format = (d: Date) =>
            d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })

        switch (filter) {
            case TransactionFilter.Today:
                return format(today)
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
            default:
                return ''
        }
    }

    const handleFilterPress = (filter: TransactionFilter) => {
        if (filter === TransactionFilter.CustomRange) {
            setView('custom_range')
        } else {
            resolve({ filter })
        }
    }

    const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
        if (!date) return

        setCustomRange(prev => ({
            ...prev,
            [activeDateInput]: date,
        }))
    }

    const handleApplyCustomRange = () => {
        resolve({ filter: TransactionFilter.CustomRange, customRange })
    }

    const renderMainView = () => (
        <>
            <PWView style={styles.header}>
                <PWView style={styles.headerSpacer} />
                <PWText
                    variant='h4'
                    style={styles.title}
                >
                    {t('transactions.filter.title')}
                </PWText>
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
                            size='lg'
                            style={styles.listIcon}
                        />
                        <PWView style={styles.listContent}>
                            <PWText
                                variant='h4'
                                style={styles.listTitle}
                            >
                                {item.title}
                            </PWText>
                            {subtitle ? (
                                <PWText
                                    variant='body'
                                    style={styles.listSubtitle}
                                >
                                    {subtitle}
                                </PWText>
                            ) : null}
                        </PWView>
                        {isSelected && (
                            <PWView style={styles.checkIcon}>
                                <PWIcon
                                    name='check'
                                    size='lg'
                                    variant='positive'
                                />
                            </PWView>
                        )}
                    </PWTouchableOpacity>
                )
            })}
            <PWButton
                title={t('common.close.label')}
                variant='secondary'
                onPress={dismiss}
                style={styles.closeButton}
            />
        </>
    )

    const renderCustomRangeView = () => (
        <>
            <PWView style={styles.header}>
                <PWTouchableOpacity onPress={() => setView('main')}>
                    <PWIcon
                        name='chevron-left'
                        size='xl'
                    />
                </PWTouchableOpacity>
                <PWText
                    variant='h4'
                    style={styles.title}
                >
                    {t('transactions.filter.custom_range')}
                </PWText>
                <PWTouchableOpacity onPress={handleApplyCustomRange}>
                    <PWText
                        variant='h4'
                        style={styles.doneButton}
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
                        onPress={() => setActiveDateInput('from')}
                    >
                        <PWText
                            variant='body'
                            style={styles.dateLabel}
                        >
                            {t('transactions.common.from')}
                        </PWText>
                        <PWText
                            variant='h4'
                            style={styles.dateValue}
                        >
                            {formatDate(customRange.from)}
                        </PWText>
                    </PWTouchableOpacity>
                    <PWTouchableOpacity
                        style={[
                            styles.dateInputWrapper,
                            activeDateInput === 'to' && styles.activeDateInput,
                        ]}
                        onPress={() => setActiveDateInput('to')}
                    >
                        <PWText
                            variant='body'
                            style={styles.dateLabel}
                        >
                            {t('transactions.common.to')}
                        </PWText>
                        <PWText
                            variant='h4'
                            style={styles.dateValue}
                        >
                            {formatDate(customRange.to)}
                        </PWText>
                    </PWTouchableOpacity>
                </PWView>

                <PWView style={styles.datePickerContainer}>
                    <DateTimePicker
                        value={
                            activeDateInput === 'from'
                                ? customRange.from
                                : customRange.to
                        }
                        mode='date'
                        display='spinner'
                        onChange={handleDateChange}
                        style={styles.datePicker}
                        textColor={styles.dateValue.color as string}
                        themeVariant='light'
                    />
                </PWView>
            </PWView>
        </>
    )

    return view === 'main' ? renderMainView() : renderCustomRangeView()
}
