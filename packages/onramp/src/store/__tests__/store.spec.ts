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
import { useOnrampStore } from '../store'

const instructions = (address: string) => ({ address, memo: null })

describe('useOnrampStore', () => {
    beforeEach(() => {
        useOnrampStore.getState().resetState()
    })

    it('setSelectedSourceTokenId updates selectedSourceTokenId', () => {
        useOnrampStore.getState().setSelectedSourceTokenId('USD')
        expect(useOnrampStore.getState().selectedSourceTokenId).toBe('USD')
    })

    it('setSelectedDestinationTokenId updates selectedDestinationTokenId', () => {
        useOnrampStore.getState().setSelectedDestinationTokenId('ALGO')
        expect(useOnrampStore.getState().selectedDestinationTokenId).toBe(
            'ALGO',
        )
    })

    it('setSelectedChainId updates selectedChainId', () => {
        useOnrampStore.getState().setSelectedChainId('ethereum')
        expect(useOnrampStore.getState().selectedChainId).toBe('ethereum')
    })

    it('persists the chosen chain beside the destination', () => {
        useOnrampStore.getState().setSelectedChainId('ethereum')

        const persisted = useOnrampStore.persist
            .getOptions()
            .partialize?.(useOnrampStore.getState())

        expect(persisted).toMatchObject({ selectedChainId: 'ethereum' })
    })

    it('resetState clears both token ids, the chain, senderAddress and the remembered deposits', () => {
        useOnrampStore.getState().setSelectedSourceTokenId('USD')
        useOnrampStore.getState().setSelectedDestinationTokenId('ALGO')
        useOnrampStore.getState().setSelectedChainId('ethereum')
        useOnrampStore.getState().setSenderAddress('ADDR')
        useOnrampStore
            .getState()
            .rememberDepositInstructions('order-1', instructions('A'))
        useOnrampStore.getState().resetState()
        const s = useOnrampStore.getState()
        expect(s.selectedSourceTokenId).toBeNull()
        expect(s.selectedDestinationTokenId).toBeNull()
        expect(s.selectedChainId).toBeNull()
        expect(s.senderAddress).toBe('')
        expect(s.depositInstructions).toEqual({})
    })

    describe('rememberDepositInstructions', () => {
        it('keeps the instructions by order id', () => {
            useOnrampStore
                .getState()
                .rememberDepositInstructions('order-1', instructions('A'))

            expect(
                useOnrampStore.getState().depositInstructions['order-1'],
            ).toEqual(instructions('A'))
        })

        it('replaces the instructions of an order remembered again', () => {
            const { rememberDepositInstructions } = useOnrampStore.getState()
            rememberDepositInstructions('order-1', instructions('A'))
            rememberDepositInstructions('order-1', instructions('B'))

            expect(useOnrampStore.getState().depositInstructions).toEqual({
                'order-1': instructions('B'),
            })
        })

        it('keeps only the newest 20 orders', () => {
            const { rememberDepositInstructions } = useOnrampStore.getState()
            for (let index = 1; index <= 21; index++) {
                rememberDepositInstructions(`order-${index}`, instructions('A'))
            }

            const ids = Object.keys(
                useOnrampStore.getState().depositInstructions,
            )
            expect(ids).toHaveLength(20)
            expect(ids).not.toContain('order-1')
            expect(ids).toContain('order-21')
        })

        it('persists the instructions but not the source token', () => {
            useOnrampStore.getState().setSelectedSourceTokenId('USD')
            useOnrampStore
                .getState()
                .rememberDepositInstructions('order-1', instructions('A'))

            const persisted = useOnrampStore.persist
                .getOptions()
                .partialize?.(useOnrampStore.getState())

            expect(persisted).toMatchObject({
                depositInstructions: { 'order-1': instructions('A') },
            })
            expect(persisted).not.toHaveProperty('selectedSourceTokenId')
        })
    })
})
