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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    encodeFunctionData,
    erc1155Abi,
    erc20Abi,
    erc721Abi,
    maxUint256,
} from 'viem'
import type { Address, Hex } from 'viem'
import { ethereumMinedViewOf } from '../review'
import { SENDER } from './fixtures'

const TOKEN: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const NFT: Address = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const SPENDER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const mined = (to: Address | undefined, data: Hex, value = 0n) =>
    ethereumMinedViewOf({ from: SENDER, to, data, value })

describe('ethereumMinedViewOf', () => {
    it('reads an unlimited approve as a contract call with its decoded call, and no signing fees', () => {
        const view = mined(
            TOKEN,
            encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [SPENDER, maxUint256],
            }),
        )

        expect(view).toMatchObject({
            kind: 'contract-call',
            isMined: true,
            call: {
                kind: 'approve',
                spender: SPENDER,
                value: new Decimal(maxUint256.toString()),
            },
        })
        expect(view).not.toHaveProperty('fee')
        expect(view).not.toHaveProperty('nonce')
    })

    it('decodes a collection-wide approval', () => {
        const view = mined(
            NFT,
            encodeFunctionData({
                abi: erc721Abi,
                functionName: 'setApprovalForAll',
                args: [SPENDER, true],
            }),
        )

        expect(view.call).toMatchObject({
            kind: 'set-approval-for-all',
            isApproved: true,
        })
    })

    it('decodes an ERC-1155 batch', () => {
        const view = mined(
            NFT,
            encodeFunctionData({
                abi: erc1155Abi,
                functionName: 'safeBatchTransferFrom',
                args: [SENDER, SPENDER, [1n, 2n], [3n, 4n], '0x'],
            }),
        )

        expect(view.call).toMatchObject({
            kind: 'erc1155-transfer',
            items: [
                { tokenId: '1', amount: new Decimal(3) },
                { tokenId: '2', amount: new Decimal(4) },
            ],
        })
    })

    it('reads a call with no calldata and a recipient as a transfer', () => {
        expect(mined(SPENDER, '0x', 5n)).toMatchObject({
            kind: 'transfer',
            isMined: true,
            value: new Decimal(5),
        })
    })

    it('carries the fee paid', () => {
        const view = ethereumMinedViewOf(
            { from: SENDER, to: SPENDER, data: '0x', value: 0n },
            new Decimal(21_000),
        )

        expect(view).toMatchObject({ feePaid: new Decimal(21_000) })
    })

    it('leaves calldata with a trailing byte undecoded', () => {
        const data = `${encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [SPENDER, 1n],
        })}00` as Hex

        expect(mined(TOKEN, data)).not.toHaveProperty('call')
    })

    it('leaves a call that sends ether undecoded', () => {
        const data = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [SPENDER, 1n],
        })

        expect(mined(TOKEN, data, 1n)).not.toHaveProperty('call')
    })
})
