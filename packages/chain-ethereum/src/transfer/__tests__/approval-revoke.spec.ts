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
import { getAddress } from 'viem'
import type { TokenApproval } from '@perawallet/wallet-core-chain-contract'
import { InvalidSendParamsError } from '@perawallet/wallet-core-transactions'
import { BASE, ETHEREUM } from '../../__tests__/evm-chains'
import { toEvmApprovalRevoke } from '../approval-revoke'

const USDC = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
const APES = getAddress('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')
const SPENDER = getAddress('0xE592427A0AEce92De3Edee1F18E0157C05861564')

const WORD = '0'.repeat(64)
const SPENDER_WORD = `${'0'.repeat(24)}e592427a0aece92de3edee1f18e0157c05861564`

const allowance: TokenApproval = {
    kind: 'allowance',
    assetRef: { chainId: 'ethereum', assetId: USDC },
    spender: SPENDER,
}

const collection: TokenApproval = {
    kind: 'collection',
    collection: APES,
    spender: SPENDER,
}

describe('toEvmApprovalRevoke', () => {
    it('revokes an allowance with approve(spender, 0) on the token', () => {
        const revoke = toEvmApprovalRevoke(allowance, ETHEREUM)

        expect(revoke.to).toBe(USDC)
        // approve(address,uint256), the spender, and an amount of zero.
        expect(revoke.data).toBe(`0x095ea7b3${SPENDER_WORD}${WORD}`)
    })

    it('revokes a collection approval with setApprovalForAll(operator, false) on the collection', () => {
        const revoke = toEvmApprovalRevoke(collection, ETHEREUM)

        expect(revoke.to).toBe(APES)
        // setApprovalForAll(address,bool), the operator, and false.
        expect(revoke.data).toBe(`0xa22cb465${SPENDER_WORD}${WORD}`)
    })

    it('titles both as a revoke of the spender, so history and review agree', () => {
        for (const approval of [allowance, collection]) {
            expect(toEvmApprovalRevoke(approval, ETHEREUM).summary).toEqual({
                kind: 'approval',
                title: { key: 'transactions.list_item.revoke_approval' },
                direction: 'none',
                counterparty: SPENDER,
                icon: 'approval',
            })
        }
    })

    it.each([
        ['a spender that is not an address', { ...allowance, spender: 'bob' }],
        [
            'a token that is not an address',
            {
                ...allowance,
                assetRef: { chainId: 'ethereum', assetId: '0xUSDC' },
            },
        ],
        [
            'a collection that is not an address',
            { ...collection, collection: 'apes' },
        ],
    ] as const)('refuses %s', (_, approval) => {
        expect(() => toEvmApprovalRevoke(approval, ETHEREUM)).toThrow(
            InvalidSendParamsError,
        )
    })

    it("refuses an allowance on another chain's token", () => {
        expect(() => toEvmApprovalRevoke(allowance, BASE)).toThrow(
            InvalidSendParamsError,
        )
    })
})
