import { describe, test, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { createAssetsSlice, type AssetsSlice } from '../store'

describe('services/assets/store', () => {
    let store: any

    beforeEach(() => {
        store = create<AssetsSlice>()(createAssetsSlice)
    })

    test('initializes with empty assetIDs', () => {
        expect(store.getState().assetIDs).toEqual([])
    })

    test('setAssetIDs updates assetIDs', () => {
        store.getState().setAssetIDs([1, 2, 3])
        expect(store.getState().assetIDs).toEqual([1, 2, 3])
    })
})