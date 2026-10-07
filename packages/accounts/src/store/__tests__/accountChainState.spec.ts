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

import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { AccountChainState } from '@perawallet/wallet-core-chain-contract'
import {
    authAddressOf,
    getAccountChainState,
    useAccountChainStateStore,
} from '../accountChainState'

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const

const algorandState = (
    overrides: Partial<Extract<AccountChainState, { family: 'algorand' }>> = {},
): AccountChainState => ({
    family: 'algorand',
    minBalance: new Decimal(100000),
    status: 'Offline',
    totalAssetsOptedIn: 0,
    totalCreatedAssets: 0,
    totalAppsOptedIn: 0,
    ...overrides,
})

const store = () => useAccountChainStateStore.getState()

describe('account chain-state slice', () => {
    beforeEach(() => {
        store().resetState()
    })

    it('round-trips an entry', () => {
        const state = algorandState({ authAddress: 'AUTH' })
        store().setAccountChainState(MAINNET, 'A', state)

        expect(getAccountChainState(MAINNET, 'A')).toBe(state)
        expect(getAccountChainState(TESTNET, 'A')).toBeUndefined()
    })

    it('keeps every reference when the write equals the held entry', () => {
        store().setAccountChainState(MAINNET, 'A', algorandState())
        const { states } = store()
        const held = getAccountChainState(MAINNET, 'A')

        store().setAccountChainState(
            MAINNET,
            'A',
            algorandState({ minBalance: new Decimal('100000') }),
        )

        expect(store().states).toBe(states)
        expect(getAccountChainState(MAINNET, 'A')).toBe(held)
    })

    it("keeps the other scope's record when one scope is written", () => {
        store().setAccountChainState(MAINNET, 'A', algorandState())
        const mainnetRecord = store().states['algorand/mainnet']

        store().setAccountChainState(TESTNET, 'A', algorandState())

        expect(store().states['algorand/mainnet']).toBe(mainnetRecord)
    })

    it('fill keeps held entries and adds missing ones', () => {
        const held = algorandState({ authAddress: 'HELD' })
        store().setAccountChainState(MAINNET, 'A', held)

        store().fillAccountChainStates({
            ['algorand/mainnet' as never]: {
                A: algorandState({ authAddress: 'OTHER' }),
                B: algorandState({ authAddress: 'NEW' }),
            },
        })

        expect(getAccountChainState(MAINNET, 'A')).toBe(held)
        expect(getAccountChainState(MAINNET, 'B')).toMatchObject({
            authAddress: 'NEW',
        })
    })

    it('remove drops the address on every scope and leaves other addresses', () => {
        store().setAccountChainState(MAINNET, 'A', algorandState())
        store().setAccountChainState(TESTNET, 'A', algorandState())
        store().setAccountChainState(MAINNET, 'B', algorandState())

        store().removeAccountChainStates('A')

        expect(getAccountChainState(MAINNET, 'A')).toBeUndefined()
        expect(getAccountChainState(TESTNET, 'A')).toBeUndefined()
        expect(getAccountChainState(MAINNET, 'B')).toBeDefined()
    })

    it('resetState empties the slice', () => {
        store().setAccountChainState(MAINNET, 'A', algorandState())

        store().resetState()

        expect(store().states).toEqual({})
    })

    it('authAddressOf is null without an authAddress, including for evm', () => {
        expect(authAddressOf(algorandState())).toBeNull()
        expect(authAddressOf({ family: 'evm' })).toBeNull()
        expect(authAddressOf(algorandState({ authAddress: 'X' }))).toBe('X')
    })
})
