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
    concat,
    encodeFunctionData,
    erc1155Abi,
    erc20Abi,
    erc721Abi,
    maxUint160,
    maxUint256,
    parseAbi,
} from 'viem'
import type { Address, Hex } from 'viem'
import { ETHEREUM } from '../../__tests__/evm-chains'
import type { EvmStandardCall } from '../standard-call-types'
import {
    approvalWarningOf,
    decodeEvmStandardCall,
    standardCallSummary,
} from '../standard-calls'
import { SENDER } from './fixtures'

const TOKEN: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const NFT: Address = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const SPENDER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const HOLDER: Address = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

const ALLOWANCE_ABI = parseAbi([
    'function increaseAllowance(address spender, uint256 addedValue)',
])

const call = (to: Address | undefined, data: Hex, value = 0n) => ({
    from: SENDER,
    to,
    data,
    value,
})

const approveData = (amount: bigint, spender: Address = SPENDER): Hex =>
    encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
    })

const setApprovalForAllData = (isApproved: boolean): Hex =>
    encodeFunctionData({
        abi: erc721Abi,
        functionName: 'setApprovalForAll',
        args: [SPENDER, isApproved],
    })

describe('decodeEvmStandardCall', () => {
    it('reads an ERC-20 transfer, with the signer as the sender', () => {
        const data = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [SPENDER, 1_000_000n],
        })

        expect(decodeEvmStandardCall(call(TOKEN, data))).toEqual({
            kind: 'transfer',
            contract: TOKEN,
            from: SENDER,
            to: SPENDER,
            value: new Decimal(1_000_000),
        })
    })

    it('reads transferFrom without deciding whether its value is an amount or a token id', () => {
        const data = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transferFrom',
            args: [HOLDER, SPENDER, 42n],
        })

        expect(decodeEvmStandardCall(call(TOKEN, data))).toEqual({
            kind: 'transfer-from',
            contract: TOKEN,
            from: HOLDER,
            to: SPENDER,
            value: new Decimal(42),
        })
    })

    it('reads both ERC-721 safeTransferFrom overloads', () => {
        const plain = encodeFunctionData({
            abi: erc721Abi,
            functionName: 'safeTransferFrom',
            args: [SENDER, SPENDER, 7n],
        })
        const withData = encodeFunctionData({
            abi: erc721Abi,
            functionName: 'safeTransferFrom',
            args: [SENDER, SPENDER, 7n, '0xdead'],
        })
        const expected: EvmStandardCall = {
            kind: 'erc721-safe-transfer',
            contract: NFT,
            from: SENDER,
            to: SPENDER,
            tokenId: '7',
        }

        expect(decodeEvmStandardCall(call(NFT, plain))).toEqual(expected)
        expect(decodeEvmStandardCall(call(NFT, withData))).toEqual(expected)
    })

    it('reads an ERC-1155 single transfer as one item', () => {
        const data = encodeFunctionData({
            abi: erc1155Abi,
            functionName: 'safeTransferFrom',
            args: [SENDER, SPENDER, 7n, 3n, '0x'],
        })

        expect(decodeEvmStandardCall(call(NFT, data))).toEqual({
            kind: 'erc1155-transfer',
            contract: NFT,
            from: SENDER,
            to: SPENDER,
            items: [{ tokenId: '7', amount: new Decimal(3) }],
        })
    })

    it('reads an ERC-1155 batch transfer item by item', () => {
        const data = encodeFunctionData({
            abi: erc1155Abi,
            functionName: 'safeBatchTransferFrom',
            args: [SENDER, SPENDER, [7n, 8n], [3n, 1n], '0x'],
        })

        expect(decodeEvmStandardCall(call(NFT, data))).toEqual({
            kind: 'erc1155-transfer',
            contract: NFT,
            from: SENDER,
            to: SPENDER,
            items: [
                { tokenId: '7', amount: new Decimal(3) },
                { tokenId: '8', amount: new Decimal(1) },
            ],
        })
    })

    it('reads approve with its raw value', () => {
        expect(
            decodeEvmStandardCall(call(TOKEN, approveData(maxUint256))),
        ).toEqual({
            kind: 'approve',
            contract: TOKEN,
            spender: SPENDER,
            value: new Decimal(maxUint256.toString()),
        })
    })

    it('reads increaseAllowance', () => {
        const data = encodeFunctionData({
            abi: ALLOWANCE_ABI,
            functionName: 'increaseAllowance',
            args: [SPENDER, 5n],
        })

        expect(decodeEvmStandardCall(call(TOKEN, data))).toEqual({
            kind: 'increase-allowance',
            contract: TOKEN,
            spender: SPENDER,
            value: new Decimal(5),
        })
    })

    it('reads setApprovalForAll granting and revoking', () => {
        expect(
            decodeEvmStandardCall(call(NFT, setApprovalForAllData(true))),
        ).toEqual({
            kind: 'set-approval-for-all',
            contract: NFT,
            operator: SPENDER,
            isApproved: true,
        })
        expect(
            decodeEvmStandardCall(call(NFT, setApprovalForAllData(false))),
        ).toMatchObject({ isApproved: false })
    })

    it('reads calldata whatever its hex case', () => {
        const data = approveData(5n).toLowerCase() as Hex

        expect(decodeEvmStandardCall(call(TOKEN, data))?.kind).toBe('approve')
    })

    describe('only when the calldata is exactly the standard function', () => {
        const approve = approveData(5n)
        const word = (hex: string): Hex => `0x${hex.padStart(64, '0')}`
        const DIRTY_ADDRESS = word(`ff${SPENDER.slice(2).toLowerCase()}`)

        const vectors: [string, ReturnType<typeof call>][] = [
            ['a trailing byte', call(TOKEN, concat([approve, '0x00']))],
            [
                'an address word with dirty high bits',
                call(
                    TOKEN,
                    concat([approve.slice(0, 10) as Hex, DIRTY_ADDRESS, word('5')]),
                ),
            ],
            [
                'a bool word that is neither 0 nor 1',
                call(
                    NFT,
                    concat([
                        setApprovalForAllData(true).slice(0, 74) as Hex,
                        word('2'),
                    ]),
                ),
            ],
            ['ether sent with the call', call(TOKEN, approve, 1n)],
            ['no contract', call(undefined, approve)],
            ['an unknown selector', call(TOKEN, '0xdeadbeef')],
            ['calldata shorter than a selector', call(TOKEN, '0x0951')],
            ['no calldata', call(TOKEN, '0x')],
            [
                'a truncated argument',
                call(TOKEN, approve.slice(0, approve.length - 2) as Hex),
            ],
            [
                'mismatched batch arrays',
                call(
                    NFT,
                    encodeFunctionData({
                        abi: erc1155Abi,
                        functionName: 'safeBatchTransferFrom',
                        args: [SENDER, SPENDER, [7n, 8n], [3n], '0x'],
                    }),
                ),
            ],
            [
                'an empty batch',
                call(
                    NFT,
                    encodeFunctionData({
                        abi: erc1155Abi,
                        functionName: 'safeBatchTransferFrom',
                        args: [SENDER, SPENDER, [], [], '0x'],
                    }),
                ),
            ],
        ]

        it.each(vectors)('stays unrecognised with %s', (_, input) => {
            expect(decodeEvmStandardCall(input)).toBeUndefined()
        })

        it('stays unrecognised when a colliding selector carries another argument layout', () => {
            // approve's selector followed by one dynamic `bytes` argument.
            const data = concat([
                approve.slice(0, 10) as Hex,
                word('20'),
                word('3'),
                `0x${'ab'.repeat(3).padEnd(64, '0')}`,
            ])

            expect(decodeEvmStandardCall(call(TOKEN, data))).toBeUndefined()
        })
    })
})

describe('standardCallSummary', () => {
    const approve = (amount: bigint): EvmStandardCall => ({
        kind: 'approve',
        contract: TOKEN,
        spender: SPENDER,
        value: new Decimal(amount.toString()),
    })

    it('summarises an approval with its spender and no direction', () => {
        expect(standardCallSummary(approve(5n), ETHEREUM)).toEqual({
            kind: 'approval',
            title: { key: 'transactions.list_item.approval' },
            direction: 'none',
            counterparty: SPENDER,
            icon: 'approval',
        })
    })

    it('titles a zero approve and a revoked collection approval as revocations', () => {
        const revokeAll: EvmStandardCall = {
            kind: 'set-approval-for-all',
            contract: NFT,
            operator: SPENDER,
            isApproved: false,
        }

        expect(standardCallSummary(approve(0n), ETHEREUM).title.key).toBe(
            'transactions.list_item.revoke_approval',
        )
        expect(standardCallSummary(revokeAll, ETHEREUM)).toMatchObject({
            kind: 'approval',
            title: { key: 'transactions.list_item.revoke_approval' },
            counterparty: SPENDER,
        })
    })

    it('summarises a token transfer from the decoded holder', () => {
        const summary = standardCallSummary(
            {
                kind: 'transfer-from',
                contract: TOKEN,
                from: HOLDER,
                to: SPENDER,
                value: new Decimal(9),
            },
            ETHEREUM,
        )

        expect(summary).toMatchObject({
            kind: 'token-transfer',
            counterparty: SPENDER,
            amount: {
                assetRef: { chainId: ETHEREUM.row.id, assetId: TOKEN },
                value: new Decimal(9),
            },
        })
    })

    it('summarises one NFT by its asset id and a batch by its balance changes', () => {
        const single = standardCallSummary(
            {
                kind: 'erc721-safe-transfer',
                contract: NFT,
                from: SENDER,
                to: SPENDER,
                tokenId: '7',
            },
            ETHEREUM,
        )
        const batch = standardCallSummary(
            {
                kind: 'erc1155-transfer',
                contract: NFT,
                from: SENDER,
                to: SPENDER,
                items: [
                    { tokenId: '7', amount: new Decimal(3) },
                    { tokenId: '8', amount: new Decimal(1) },
                ],
            },
            ETHEREUM,
        )

        expect(single).toMatchObject({
            kind: 'nft-transfer',
            amount: {
                assetRef: { chainId: ETHEREUM.row.id, assetId: `${NFT}/7` },
                value: new Decimal(1),
            },
        })
        expect(batch).toMatchObject({
            kind: 'nft-transfer',
            counterparty: SPENDER,
            balanceChanges: [
                {
                    assetRef: { chainId: ETHEREUM.row.id, assetId: `${NFT}/7` },
                    value: new Decimal(-3),
                },
                {
                    assetRef: { chainId: ETHEREUM.row.id, assetId: `${NFT}/8` },
                    value: new Decimal(-1),
                },
            ],
        })
    })
})

describe('approvalWarningOf', () => {
    const approve = (
        amount: bigint,
        kind: 'approve' | 'increase-allowance' = 'approve',
    ): EvmStandardCall => ({
        kind,
        contract: TOKEN,
        spender: SPENDER,
        value: new Decimal(amount.toString()),
    })

    it('is a danger when the allowance counts as unlimited', () => {
        expect(approvalWarningOf(approve(maxUint160))?.severity).toBe('danger')
        expect(approvalWarningOf(approve(maxUint256))?.severity).toBe('danger')
        expect(
            approvalWarningOf(approve(maxUint256, 'increase-allowance'))
                ?.severity,
        ).toBe('danger')
    })

    it('is a warning for a limited grant', () => {
        expect(approvalWarningOf(approve(maxUint160 - 1n))).toMatchObject({
            type: 'token-approval',
            severity: 'warning',
        })
    })

    it('is a danger for a collection-wide grant', () => {
        expect(
            approvalWarningOf({
                kind: 'set-approval-for-all',
                contract: NFT,
                operator: SPENDER,
                isApproved: true,
            }),
        ).toMatchObject({ type: 'token-approval', severity: 'danger' })
    })

    it('stays silent for revocations and transfers', () => {
        expect(approvalWarningOf(approve(0n))).toBeUndefined()
        expect(
            approvalWarningOf({
                kind: 'set-approval-for-all',
                contract: NFT,
                operator: SPENDER,
                isApproved: false,
            }),
        ).toBeUndefined()
        expect(
            approvalWarningOf({
                kind: 'transfer',
                contract: TOKEN,
                from: SENDER,
                to: SPENDER,
                value: new Decimal(1),
            }),
        ).toBeUndefined()
    })
})
