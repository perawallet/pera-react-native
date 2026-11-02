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

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { toAssetInboxQuote } from '@perawallet/wallet-core-transactions'

import { useSendFundsStore, useSendFunds } from '../useSendFunds'

describe('useSendFundsStore', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
    })

    it('has correct initial state', () => {
        const { result } = renderHook(() => useSendFundsStore())

        expect(result.current.selectedAsset).toBeUndefined()
        expect(result.current.canSelectAsset).toBe(true)
        expect(result.current.amount).toBeUndefined()
        expect(result.current.note).toBeUndefined()
        expect(result.current.destination).toBeUndefined()
    })

    it('sets selectedAsset', () => {
        const { result } = renderHook(() => useSendFundsStore())

        act(() => {
            result.current.setSelectedAsset({
                chainId: 'algorand',
                assetId: '123',
            })
        })

        expect(result.current.selectedAsset).toEqual({
            chainId: 'algorand',
            assetId: '123',
        })
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

    it('holds the asset inbox quote until the flow resets', () => {
        const { result } = renderHook(() => useSendFundsStore())
        const quote = toAssetInboxQuote({ fee: 1 })

        act(() => {
            result.current.setSendMode('sendAssetInbox')
            result.current.setAssetInboxQuote(quote)
        })

        expect(result.current.sendMode).toBe('sendAssetInbox')
        expect(result.current.assetInboxQuote).toBe(quote)

        act(() => {
            result.current.reset()
        })

        expect(result.current.assetInboxQuote).toBeUndefined()
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

    it('drops the recipient acknowledgement when the destination changes', () => {
        const { result } = renderHook(() => useSendFundsStore())

        act(() => {
            result.current.setDestination('ALGO_ADDRESS')
            result.current.setIsRecipientAcknowledged(true)
        })
        expect(result.current.isRecipientAcknowledged).toBe(true)

        act(() => {
            result.current.setDestination('OTHER_ADDRESS')
        })

        expect(result.current.isRecipientAcknowledged).toBe(false)
    })

    it('resets all state to initial values', () => {
        const { result } = renderHook(() => useSendFundsStore())

        act(() => {
            result.current.setSelectedAsset({
                chainId: 'algorand',
                assetId: '123',
            })
            result.current.setCanSelectAsset(false)
            result.current.setAmount(new Decimal('10.5'))
            result.current.setNote('Test note')
            result.current.setDestination('ALGO_ADDRESS')
        })

        act(() => {
            result.current.reset()
        })

        expect(result.current.selectedAsset).toBeUndefined()
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
            result.current.setSelectedAsset({
                chainId: 'algorand',
                assetId: '123',
            })
            result.current.setCanSelectAsset(false)
            result.current.setAmount(amount)
            result.current.setNote('hello')
            result.current.setDestination('DEST_ADDR')
        })

        expect(result.current.selectedAsset).toEqual({
            chainId: 'algorand',
            assetId: '123',
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
            result.current.setSelectedAsset({
                chainId: 'algorand',
                assetId: '1',
            })
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

describe('useSendFunds chain', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
    })

    it('holds the chosen network until the flow resets', () => {
        const { result } = renderHook(() => useSendFunds())

        act(() => result.current.setChainId('ethereum'))
        expect(result.current.chainId).toBe('ethereum')

        act(() => result.current.reset())
        expect(result.current.chainId).toBeUndefined()
    })
})

describe('useSendFunds fee preset', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
    })

    it('starts at the normal preset', () => {
        const { result } = renderHook(() => useSendFunds())

        expect(result.current.feePreset).toBe('normal')
    })

    it('keeps the preset the user picks', () => {
        const { result } = renderHook(() => useSendFunds())

        act(() => {
            result.current.setFeePreset('fast')
        })

        expect(result.current.feePreset).toBe('fast')
    })

    it('returns to the normal preset when the send resets', () => {
        const { result } = renderHook(() => useSendFunds())
        act(() => {
            result.current.setFeePreset('slow')
        })

        act(() => {
            result.current.reset()
        })

        expect(result.current.feePreset).toBe('normal')
    })
})

describe('useSendFunds max amount', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
    })

    it('keeps the max flag and the confirmed max fee until the send resets', () => {
        const { result } = renderHook(() => useSendFunds())
        expect(result.current.isMaxAmount).toBe(false)
        expect(result.current.confirmedMaxFee).toBeUndefined()

        act(() => {
            result.current.setIsMaxAmount(true)
            result.current.setConfirmedMaxFee(new Decimal(42))
        })
        expect(result.current.isMaxAmount).toBe(true)
        expect(result.current.confirmedMaxFee).toEqual(new Decimal(42))

        act(() => {
            result.current.reset()
        })
        expect(result.current.isMaxAmount).toBe(false)
        expect(result.current.confirmedMaxFee).toBeUndefined()
    })
})
