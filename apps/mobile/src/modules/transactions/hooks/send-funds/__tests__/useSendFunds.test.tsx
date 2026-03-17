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

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import Decimal from 'decimal.js'

import { useSendFundsStore, useSendFunds } from '../useSendFunds'

describe('useSendFundsStore', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
    })

    it('has correct initial state', () => {
        const { result } = renderHook(() => useSendFundsStore())

        expect(result.current.selectedAssetId).toBeUndefined()
        expect(result.current.canSelectAsset).toBe(true)
        expect(result.current.amount).toBeUndefined()
        expect(result.current.note).toBeUndefined()
        expect(result.current.destination).toBeUndefined()
    })

    it('sets selectedAssetId', () => {
        const { result } = renderHook(() => useSendFundsStore())

        act(() => {
            result.current.setSelectedAssetId('123')
        })

        expect(result.current.selectedAssetId).toBe('123')
    })

    it('sets canSelectAsset', () => {
        const { result } = renderHook(() => useSendFundsStore())

        act(() => {
            result.current.setCanSelectAsset(false)
        })

        expect(result.current.canSelectAsset).toBe(false)
    })

    it('sets amount', () => {
        const { result } = renderHook(() => useSendFundsStore())
        const amount = new Decimal('10.5')

        act(() => {
            result.current.setAmount(amount)
        })

        expect(result.current.amount).toBe(amount)
    })

    it('sets note', () => {
        const { result } = renderHook(() => useSendFundsStore())

        act(() => {
            result.current.setNote('Test note')
        })

        expect(result.current.note).toBe('Test note')
    })

    it('sets destination', () => {
        const { result } = renderHook(() => useSendFundsStore())

        act(() => {
            result.current.setDestination('ALGO_ADDRESS')
        })

        expect(result.current.destination).toBe('ALGO_ADDRESS')
    })

    it('resets all state to initial values', () => {
        const { result } = renderHook(() => useSendFundsStore())

        act(() => {
            result.current.setSelectedAssetId('123')
            result.current.setCanSelectAsset(false)
            result.current.setAmount(new Decimal('10.5'))
            result.current.setNote('Test note')
            result.current.setDestination('ALGO_ADDRESS')
        })

        act(() => {
            result.current.reset()
        })

        expect(result.current.selectedAssetId).toBeUndefined()
        expect(result.current.canSelectAsset).toBe(true)
        expect(result.current.amount).toBeUndefined()
        expect(result.current.note).toBeUndefined()
        expect(result.current.destination).toBeUndefined()
    })
})

describe('useSendFunds', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
    })

    it('returns initial state via granular selectors', () => {
        const { result } = renderHook(() => useSendFunds())

        expect(result.current.selectedAssetId).toBeUndefined()
        expect(result.current.canSelectAsset).toBe(true)
        expect(result.current.amount).toBeUndefined()
        expect(result.current.note).toBeUndefined()
        expect(result.current.destination).toBeUndefined()
    })

    it('exposes setters that update the store', () => {
        const { result } = renderHook(() => useSendFunds())
        const amount = new Decimal('5')

        act(() => {
            result.current.setSelectedAssetId('123')
            result.current.setCanSelectAsset(false)
            result.current.setAmount(amount)
            result.current.setNote('hello')
            result.current.setDestination('DEST_ADDR')
        })

        expect(result.current.selectedAssetId).toBe('123')
        expect(result.current.canSelectAsset).toBe(false)
        expect(result.current.amount).toBe(amount)
        expect(result.current.note).toBe('hello')
        expect(result.current.destination).toBe('DEST_ADDR')
    })

    it('reset restores initial state', () => {
        const { result } = renderHook(() => useSendFunds())

        act(() => {
            result.current.setSelectedAssetId('1')
            result.current.setAmount(new Decimal('99'))
        })

        act(() => {
            result.current.reset()
        })

        expect(result.current.selectedAssetId).toBeUndefined()
        expect(result.current.amount).toBeUndefined()
        expect(result.current.canSelectAsset).toBe(true)
    })
})
