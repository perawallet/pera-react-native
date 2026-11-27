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

import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { EvmContractAction } from '@perawallet/wallet-core-chain-ethereum'
import { tokenSlotsOf } from '../contractActionTokenSlots'

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const EMPTY = { assetId: '', baseUnits: undefined }

describe('tokenSlotsOf', () => {
    it('puts a token bridge in the first slot, sized by its amount', () => {
        const action: EvmContractAction = {
            kind: 'bridge',
            asset: { kind: 'token', contract: USDC },
            amount: new Decimal(95_000_000),
            destinationChainId: 1,
        }

        expect(tokenSlotsOf(action)).toEqual([
            { assetId: USDC, baseUnits: new Decimal(95_000_000) },
            EMPTY,
            EMPTY,
        ])
    })

    it('needs no token record for a native bridge', () => {
        const action: EvmContractAction = {
            kind: 'bridge',
            asset: { kind: 'native' },
            amount: new Decimal(1),
            destinationChainId: 1,
        }

        expect(tokenSlotsOf(action)).toEqual([EMPTY, EMPTY, EMPTY])
    })

    it('gives a swap fee its own slot without an amount, since each fee is sized against its record', () => {
        const action: EvmContractAction = {
            kind: 'swap',
            input: {
                asset: { kind: 'token', contract: USDC },
                amount: new Decimal(5),
                bound: 'exact',
            },
            output: {
                asset: { kind: 'native' },
                amount: new Decimal(7),
                bound: 'at-least',
            },
            fees: [
                {
                    token: USDC,
                    recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                    size: { kind: 'bips', bips: 25 },
                },
            ],
        }

        expect(tokenSlotsOf(action)).toEqual([
            { assetId: USDC, baseUnits: new Decimal(5) },
            EMPTY,
            { assetId: USDC, baseUnits: undefined },
        ])
    })
})
