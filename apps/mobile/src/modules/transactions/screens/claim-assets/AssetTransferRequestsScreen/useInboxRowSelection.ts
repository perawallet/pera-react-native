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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BackHandler } from 'react-native'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { isSelectable, type InboxRequestRow } from './inboxRequestRow'

export type UseInboxRowSelectionResult = {
    /** Null while not selecting. */
    selectedKeys: Nullable<ReadonlySet<string>>
    isAllSelected: boolean
    toggleRow: (row: InboxRequestRow) => void
    /** Starts selecting with the row ticked; does nothing once selecting. */
    startWith: (row: InboxRequestRow) => void
    toggleAll: () => void
    clear: () => void
}

export const useInboxRowSelection = (
    rows: readonly InboxRequestRow[],
): UseInboxRowSelectionResult => {
    const [selection, setSelection] =
        useState<Nullable<ReadonlySet<string>>>(null)

    const selectableKeys = useMemo(
        () => rows.filter(isSelectable).map(row => row.key),
        [rows],
    )

    // A refetch can drop rows that were selected; only live ones count.
    const selectedKeys = useMemo(
        () =>
            selection === null
                ? null
                : new Set(selectableKeys.filter(key => selection.has(key))),
        [selection, selectableKeys],
    )

    const isAllSelected =
        selectedKeys !== null &&
        selectableKeys.length > 0 &&
        selectedKeys.size === selectableKeys.length

    const toggleRow = useCallback((row: InboxRequestRow) => {
        if (!isSelectable(row)) return
        setSelection(current => {
            const next = new Set(current ?? [])
            if (next.has(row.key)) next.delete(row.key)
            else next.add(row.key)
            return next
        })
    }, [])

    const startWith = useCallback(
        (row: InboxRequestRow) => {
            if (selection === null) toggleRow(row)
        },
        [selection, toggleRow],
    )

    const toggleAll = useCallback(() => {
        setSelection(isAllSelected ? new Set() : new Set(selectableKeys))
    }, [isAllSelected, selectableKeys])

    const clear = useCallback(() => setSelection(null), [])

    // Android's back button leaves selection before it leaves the screen.
    const isSelecting = selection !== null
    useEffect(() => {
        if (!isSelecting) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                clear()
                return true
            },
        )
        return () => subscription.remove()
    }, [isSelecting, clear])

    return {
        selectedKeys,
        isAllSelected,
        toggleRow,
        startWith,
        toggleAll,
        clear,
    }
}
