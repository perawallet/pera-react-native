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

import { describe, expect, test } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { queryKeyReferencesScope } from '@perawallet/wallet-core-chain-contract'
import { CardWalletKind } from '../../models'
import {
    cardQueryKeys,
    invalidateCardQueries,
    MODULE_PREFIX,
} from '../querykeys'

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const

describe('cardQueryKeys', () => {
    test('status key carries the scope object', () => {
        expect(cardQueryKeys.status(MAINNET)).toEqual([
            MODULE_PREFIX,
            'status',
            { scope: MAINNET },
        ])
    })

    test('keys reference only their own scope', () => {
        const key = cardQueryKeys.usdcBalance(MAINNET, 'ADDR')

        expect(queryKeyReferencesScope(key, MAINNET)).toBe(true)
        expect(queryKeyReferencesScope(key, TESTNET)).toBe(false)
    })

    test('walletHistoryByKind is a prefix of walletHistory', () => {
        const prefix = cardQueryKeys.walletHistoryByKind(
            MAINNET,
            CardWalletKind.Reward,
        )
        const full = cardQueryKeys.walletHistory(
            MAINNET,
            CardWalletKind.Reward,
            'wallet-1',
        )

        expect(full.slice(0, 2)).toEqual(prefix.slice(0, 2))
        expect(full[2]).toMatchObject(prefix[2])
    })
})

describe('invalidateCardQueries', () => {
    const arrange = () => {
        const queryClient = new QueryClient()
        const statusKey = cardQueryKeys.status(TESTNET)
        const switchKey = cardQueryKeys.autoDrawEnabled(TESTNET, 'OWNER')
        const otherKey = ['accounts', 'list']
        queryClient.setQueryData(statusKey, null)
        queryClient.setQueryData(switchKey, true)
        queryClient.setQueryData(otherKey, [])
        const isStale = (key: readonly unknown[]) =>
            queryClient.getQueryState(key)?.isInvalidated
        return { queryClient, statusKey, switchKey, otherKey, isStale }
    }

    test('marks every card query stale and leaves other modules alone', () => {
        const { queryClient, statusKey, switchKey, otherKey, isStale } =
            arrange()

        invalidateCardQueries(queryClient)

        expect(isStale(statusKey)).toBe(true)
        expect(isStale(switchKey)).toBe(true)
        expect(isStale(otherKey)).toBe(false)
    })

    test('can keep a just-confirmed auto-draw switch', () => {
        const { queryClient, statusKey, switchKey, isStale } = arrange()

        invalidateCardQueries(queryClient, { exceptAutoDrawSwitch: true })

        expect(isStale(statusKey)).toBe(true)
        expect(isStale(switchKey)).toBe(false)
    })
})
