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

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ListRenderItemInfo } from '@shopify/flash-list'
import { useAssetSelectionList } from '../useAssetSelectionList'

type Row = { id: string }

const renderItem = (info: ListRenderItemInfo<Row>) => info.item.id
const keyExtractor = (row: Row) => row.id

describe('useAssetSelectionList', () => {
    it('fills the list with skeleton rows while the first load is in flight', () => {
        const {result} = renderHook(() =>
            useAssetSelectionList<Row>({
                data: undefined,
                renderItem,
                keyExtractor,
                isLoading: true,
                skeletonCount: 3,
            }),
        )

        expect(result.current.showSkeletons).toBe(true)
        expect(result.current.listData).toHaveLength(3)
        expect(result.current.keyExtractorFn(result.current.listData[0])).toBe(
            'asset-skeleton-0',
        )
    })

    it('keeps the rows it has once the load has finished', () => {
        const {result} = renderHook(() =>
            useAssetSelectionList<Row>({
                data: [{ id: 'first' }],
                renderItem,
                keyExtractor,
                isLoading: false,
                skeletonCount: 3,
            }),
        )

        expect(result.current.showSkeletons).toBe(false)
        expect(result.current.listData).toEqual([{ id: 'first' }])
        expect(result.current.keyExtractorFn(result.current.listData[0])).toBe(
            'first',
        )
    })
})
