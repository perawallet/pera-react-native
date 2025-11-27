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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { createAssetsStore } from '../index'

describe('services/assets/store', () => {
    let store: any
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }

    beforeEach(() => {
        store = createAssetsStore(mockStorage as any)
        vi.clearAllMocks()
    })

    test('initializes with empty assetIDs', () => {
        expect(store.getState().assetIDs).toEqual([])
    })

    test('setAssetIDs updates assetIDs', () => {
        store.getState().setAssetIDs([1, 2, 3])
        expect(store.getState().assetIDs).toEqual([1, 2, 3])
    })
})
