import React, { useState, useEffect } from 'react'
import { View, TouchableOpacity } from 'react-native'
import {
    PWBottomSheet,
    PWIcon,
    PWText,
    PWButton,
    PWTouchableOpacity,
} from '@components/core'
import DateTimePicker, {
    DateTimePickerEvent,
} from '@react-native-community/datetimepicker'

import { useStyles } from './styles'
import { TransactionFilter, CustomDateRange } from './types'

export type TransactionsFilterBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    activeFilter: TransactionFilter
    onApplyFilter: (
        filter: TransactionFilter,
        customRange?: CustomDateRange,
    ) => void
    initialCustomRange?: CustomDateRange
}

export const TransactionsFilterBottomSheet = ({
    isVisible,
    onClose,
    activeFilter,
    onApplyFilter,
    initialCustomRange,
}: TransactionsFilterBottomSheetProps) => {
    const styles = useStyles()

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

    // Reset view when opening
    useEffect(() => {
        if (isVisible) {
            setView('main')
            if (initialCustomRange) {
                setCustomRange(initialCustomRange)
            }
        }
    }, [isVisible, initialCustomRange])

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
            onApplyFilter(filter)
            onClose()
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
        onApplyFilter(TransactionFilter.CustomRange, customRange)
        onClose()
    }

    const renderMainView = () => (
        <>
            <View style={styles.header}>
                <View style={styles.headerSpacer} />
                <PWText style={styles.title}>Filter</PWText>
                <View style={styles.headerSpacer} />
            </View>

            {[
                {
                    id: TransactionFilter.AllTime,
                    icon: 'text-document' as const,
                    title: 'All Time',
                },
                {
                    id: TransactionFilter.Today,
                    icon: 'text-document' as const,
                    title: 'Today',
                },
                {
                    id: TransactionFilter.Yesterday,
                    icon: 'text-document' as const,
                    title: 'Yesterday',
                },
                {
                    id: TransactionFilter.LastWeek,
                    icon: 'text-document' as const,
                    title: 'Last Week',
                },
                {
                    id: TransactionFilter.LastMonth,
                    icon: 'text-document' as const,
                    title: 'Last Month',
                },
                {
                    id: TransactionFilter.CustomRange,
                    icon: 'sliders' as const,
                    title: 'Custom Range',
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
                        <View style={styles.listContent}>
                            <PWText style={styles.listTitle}>
                                {item.title}
                            </PWText>
                            {subtitle ? (
                                <PWText style={styles.listSubtitle}>
                                    {subtitle}
                                </PWText>
                            ) : null}
                        </View>
                        {isSelected && (
                            <View style={styles.checkIcon}>
                                <PWIcon
                                    name='check'
                                    size='lg'
                                    variant='positive'
                                />
                            </View>
                        )}
                    </PWTouchableOpacity>
                )
            })}
            <PWButton
                title='Close'
                variant='secondary'
                onPress={onClose}
                style={styles.closeButton}
            />
        </>
    )

    const renderCustomRangeView = () => (
        <>
            <View style={styles.header}>
                <PWTouchableOpacity onPress={() => setView('main')}>
                    <PWIcon
                        name='chevron-left'
                        size='xl'
                    />
                </PWTouchableOpacity>
                <PWText style={styles.title}>Custom Range</PWText>
                <TouchableOpacity onPress={handleApplyCustomRange}>
                    <PWText style={styles.doneButton}>Done</PWText>
                </TouchableOpacity>
            </View>

            <View style={styles.customRangeContainer}>
                <View style={styles.dateInputsContainer}>
                    <TouchableOpacity
                        style={[
                            styles.dateInputWrapper,
                            activeDateInput === 'from' &&
                                styles.activeDateInput,
                        ]}
                        onPress={() => setActiveDateInput('from')}
                    >
                        <PWText style={styles.dateLabel}>From</PWText>
                        <PWText style={styles.dateValue}>
                            {formatDate(customRange.from)}
                        </PWText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.dateInputWrapper,
                            activeDateInput === 'to' && styles.activeDateInput,
                        ]}
                        onPress={() => setActiveDateInput('to')}
                    >
                        <PWText style={styles.dateLabel}>To</PWText>
                        <PWText style={styles.dateValue}>
                            {formatDate(customRange.to)}
                        </PWText>
                    </TouchableOpacity>
                </View>

                <View style={styles.datePickerContainer}>
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
                </View>
            </View>
        </>
    )

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            {view === 'main' ? renderMainView() : renderCustomRangeView()}
        </PWBottomSheet>
    )
}
