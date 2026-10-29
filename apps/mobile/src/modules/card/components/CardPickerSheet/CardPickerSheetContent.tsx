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

import { useCallback } from 'react'
import {
    PWButton,
    PWFlatList,
    PWLoadingIndicator,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { SearchInput } from '@components/SearchInput'
import { EmptyView } from '@components/EmptyView'
import { useStyles } from './styles'

export type CardPickerSheetCopy = {
    searchPlaceholder?: string
    emptyTitle: string
    emptyBody: string
    errorTitle: string
    errorBody: string
    retry: string
}

export type CardPickerSheetContentProps<T> = {
    title: string
    items: T[]
    /** Leave out for a short fixed list, which shows no search box. */
    search?: string
    onSearchChange?: (value: string) => void
    isLoading: boolean
    isError: boolean
    onRetry: () => void
    onSelect: (item: T) => void
    getKey: (item: T) => string
    getLabel: (item: T) => string
    getTestID: (item: T) => string
    copy: CardPickerSheetCopy
}

/** The list sheet the card signup pickers share, searchable when long. */
export const CardPickerSheetContent = <T,>({
    title,
    items,
    search,
    onSearchChange,
    isLoading,
    isError,
    onRetry,
    onSelect,
    getKey,
    getLabel,
    getTestID,
    copy,
}: CardPickerSheetContentProps<T>) => {
    const styles = useStyles()

    const renderItem = useCallback(
        ({ item }: { item: T }) => (
            <PWTouchableOpacity
                style={styles.row}
                onPress={() => onSelect(item)}
                testID={getTestID(item)}
            >
                <PWText variant='body'>{getLabel(item)}</PWText>
            </PWTouchableOpacity>
        ),
        [onSelect, getLabel, getTestID, styles.row],
    )

    const renderBody = () => {
        if (isError) {
            return (
                <EmptyView
                    style={styles.center}
                    title={copy.errorTitle}
                    body={copy.errorBody}
                    button={
                        <PWButton
                            variant='secondary'
                            title={copy.retry}
                            onPress={onRetry}
                        />
                    }
                />
            )
        }
        if (isLoading) {
            return (
                <PWView style={styles.center}>
                    <PWLoadingIndicator />
                </PWView>
            )
        }
        return (
            <PWView style={styles.content}>
                {onSearchChange ? (
                    <SearchInput
                        value={search ?? ''}
                        onChangeText={onSearchChange}
                        placeholder={copy.searchPlaceholder}
                    />
                ) : null}
                <PWFlatList
                    inBottomSheet
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={getKey}
                    style={styles.list}
                    keyboardShouldPersistTaps='handled'
                    ListEmptyComponent={
                        <EmptyView
                            title={copy.emptyTitle}
                            body={copy.emptyBody}
                        />
                    }
                />
            </PWView>
        )
    }

    return (
        <PWView style={styles.container}>
            <SheetHeader title={title} />

            {renderBody()}
        </PWView>
    )
}
