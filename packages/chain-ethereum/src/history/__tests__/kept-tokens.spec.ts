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
import { getAddress } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    keptAssetIdsOf,
    useKeptTokensStore,
} from '@perawallet/wallet-core-accounts'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { evmHistoryItem } from '../api/msw-handlers'
import { evmHistoryItemSchema } from '../api/schema'
import { keepTokensTheAccountMoved } from '../kept-tokens'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = '0x00000000000000000000000000000000000000aa'
const PEER = '0x00000000000000000000000000000000000000bb'
const TOKEN = '0x6b175474e89094c44da98b954eedeac495271d0f'
const OTHER = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const impact = (contract: string) => ({
    asset_id: `eip155:1/erc20:${contract}`,
    amount: '1',
})

const item = (overrides: Parameters<typeof evmHistoryItem>[0]) =>
    evmHistoryItemSchema.parse(evmHistoryItem(overrides))

const kept = () =>
    keptAssetIdsOf(useKeptTokensStore.getState().keptTokens, ME, SCOPE)

beforeEach(() => {
    useKeptTokensStore.getState().resetState()
})

describe('keepTokensTheAccountMoved', () => {
    it('keeps the tokens of a transaction the account signed', () => {
        keepTokensTheAccountMoved(
            [
                item({
                    from: ME.toUpperCase().replace('0X', '0x'),
                    to: PEER,
                    balance_impacts: [
                        impact(TOKEN),
                        { asset_id: 'eip155:1/slip44:60', amount: '-1' },
                    ],
                }),
            ],
            ME,
            SCOPE,
            ETHEREUM,
        )

        expect(kept()).toEqual([getAddress(TOKEN)])
    })

    it('keeps nothing from a transfer someone else sent', () => {
        keepTokensTheAccountMoved(
            [
                item({
                    from: PEER,
                    to: ME,
                    balance_impacts: [impact(OTHER)],
                }),
            ],
            ME,
            SCOPE,
            ETHEREUM,
        )

        expect(kept()).toEqual([])
    })

    it('keeps nothing from a failed transaction', () => {
        keepTokensTheAccountMoved(
            [
                item({
                    from: ME,
                    status: 'failed',
                    balance_impacts: [impact(TOKEN)],
                }),
            ],
            ME,
            SCOPE,
            ETHEREUM,
        )

        expect(kept()).toEqual([])
    })
})
