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
import {
    queryKeyReferencesScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { CardWalletKind } from '../../models'
import { cardQueryKeys, MODULE_PREFIX } from '../querykeys'

const MAINNET = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const TESTNET = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const

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
