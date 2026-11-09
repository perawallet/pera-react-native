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
import { encodeFunctionData, maxUint256, parseAbi } from 'viem'
import type { Address } from 'viem'
import { ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { V3_EXACT_IN_PERMIT_SWEEP } from '../../signing/__tests__/contract-action-fixtures'
import { SENDER } from '../../signing/__tests__/fixtures'
import { findKnownEvmContract } from '../../signing/known-contracts'
import { decodedCallSummary } from '../decoded-call-summary'

const USDT: Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const SPENDER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const scope = evmScopeOf(ETHEREUM)

const ERC20 = parseAbi([
    'function approve(address spender, uint256 value)',
    'function setApprovalForAll(address operator, bool approved)',
])

const summarize = (
    call: { to?: Address; data: `0x${string}`; value?: bigint; from?: Address },
    isDecoding = true,
) =>
    decodedCallSummary(
        { from: SENDER, value: 0n, ...call },
        ETHEREUM,
        scope,
        isDecoding,
    )

const approve = (value: bigint) =>
    encodeFunctionData({
        abi: ERC20,
        functionName: 'approve',
        args: [SPENDER, value],
    })

describe('decodedCallSummary', () => {
    it('names an unlimited approval after its token and spender, whatever the capabilities', () => {
        const summary = summarize(
            { to: USDT, data: approve(maxUint256) },
            false,
        )

        expect(summary).toMatchObject({
            kind: 'approval',
            icon: 'approval',
            counterparty: SPENDER,
            subjectAsset: { chainId: 'ethereum', assetId: USDT },
        })
        expect(summary.title.key).toBe('transactions.list_item.approve_asset')
        expect(summary.subtitle).toBeUndefined()
    })

    it('calls an approve of zero a revocation', () => {
        const summary = summarize({ to: USDT, data: approve(0n) })

        expect(summary.kind).toBe('approval')
        expect(summary.title.key).toBe('transactions.list_item.revoke_approval')
        expect(summary.counterparty).toBe(SPENDER)
    })

    it('reads a collection approval by its operator and a withdrawn one as a revocation', () => {
        const data = (approved: boolean) =>
            encodeFunctionData({
                abi: ERC20,
                functionName: 'setApprovalForAll',
                args: [SPENDER, approved],
            })

        const granted = summarize({ to: USDT, data: data(true) })
        const revoked = summarize({ to: USDT, data: data(false) })

        expect(granted.counterparty).toBe(SPENDER)
        expect(granted.title.key).toBe('transactions.list_item.approve_asset')
        expect(revoked.title.key).toBe('transactions.list_item.revoke_approval')
    })

    it('titles a swap through the router while decoding', () => {
        const { from, to, data, value } = V3_EXACT_IN_PERMIT_SWEEP

        const summary = summarize({ from, to, data, value })

        expect(summary.kind).toBe('swap')
        expect(summary.title.key).toBe('transactions.list_item.swap')
        expect(summary.subtitle?.params).toEqual({
            title: findKnownEvmContract(1, to)?.name,
        })
    })

    it('leaves the same router call a generic interaction without a subtitle when decoding is off', () => {
        const { from, to, data, value } = V3_EXACT_IN_PERMIT_SWEEP

        const summary = summarize({ from, to, data, value }, false)

        expect(summary.kind).toBe('contract-call')
        expect(summary.title.key).toBe(
            'transactions.list_item.contract_interaction',
        )
        expect(summary.subtitle).toBeUndefined()
    })

    it('names a wrapped native deposit while decoding', () => {
        const data = encodeFunctionData({
            abi: parseAbi(['function deposit()']),
            functionName: 'deposit',
        })

        const summary = summarize({ to: WETH, data, value: 10n ** 18n })

        expect(summary.title.key).toBe('transactions.list_item.wrap')
        expect(summary.subtitle).toBeDefined()
    })

    it('adds only the protocol subtitle to a known contract it cannot decode', () => {
        const summary = summarize({ to: PERMIT2, data: '0x12345678' })

        expect(summary.kind).toBe('contract-call')
        expect(summary.title.key).toBe(
            'transactions.list_item.contract_interaction',
        )
        expect(summary.subtitle).toBeDefined()
    })

    it('gives an approval on a known contract its protocol subtitle only while decoding', () => {
        const data = approve(maxUint256)

        const decoding = summarize({ to: WETH, data }, true)
        const off = summarize({ to: WETH, data }, false)

        expect(decoding.kind).toBe('approval')
        expect(decoding.subtitle?.params).toEqual({
            title: findKnownEvmContract(1, WETH)?.name,
        })
        expect(off.kind).toBe('approval')
        expect(off.subtitle).toBeUndefined()
    })

    it('titles a contract deployment as a generic interaction', () => {
        const summary = summarize({ data: '0x6080604052' })

        expect(summary.kind).toBe('contract-call')
        expect(summary.title.key).toBe(
            'transactions.list_item.contract_interaction',
        )
    })

    it('keeps a plain value transfer as a transfer', () => {
        const summary = summarize({ to: SPENDER, data: '0x', value: 5n })

        expect(summary.kind).toBe('transfer')
    })
})
