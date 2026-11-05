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

import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useEvmContractAbiQuery,
    type EthereumTransactionView,
    type EvmContractAbiAnswer,
    type UseEvmContractAbiQueryResult,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { useEthereumVerifiedCall } from '../useEthereumVerifiedCall'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapability: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-ethereum', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-ethereum')
    >()),
    useEvmContractAbiQuery: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SIGNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const TARGET = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const IMPLEMENTATION = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

const CLAIM = {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
} as const

// claim(SIGNER)
const CLAIM_DATA =
    '0x1e83409a000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266'

const viewWith = (
    overrides: Partial<EthereumTransactionView> = {},
): EthereumTransactionView =>
    ({
        kind: 'contract-call',
        from: SIGNER,
        to: TARGET,
        value: new Decimal(0),
        data: CLAIM_DATA,
        selector: '0x1e83409a',
        isPreview: true,
        ...overrides,
    }) as EthereumTransactionView

const answering = (result: Partial<UseEvmContractAbiQueryResult>) =>
    vi.mocked(useEvmContractAbiQuery).mockReturnValue({
        data: undefined,
        isPending: false,
        isError: false,
        ...result,
    })

const verified = (
    abi: readonly unknown[],
    implementation?: `0x${string}`,
): EvmContractAbiAnswer => ({
    status: 'verified',
    abi,
    ...(implementation && { proxy: { implementation } }),
})

const render = (
    view: EthereumTransactionView | null = viewWith(),
    isEnabled = true,
) =>
    renderHook(() => useEthereumVerifiedCall(view, SCOPE, isEnabled)).result
        .current

const lookupEnabled = () =>
    vi.mocked(useEvmContractAbiQuery).mock.lastCall?.[0].isEnabled

describe('useEthereumVerifiedCall', () => {
    beforeEach(() => {
        vi.mocked(useChainCapability).mockReturnValue(true)
        answering({})
    })

    it('names a call that decodes exactly under the verified ABI', () => {
        answering({ data: verified([CLAIM]) })

        expect(render()).toEqual({
            status: 'decoded',
            call: {
                functionName: 'claim',
                signature: 'claim(address)',
                arguments: [
                    {
                        name: 'to',
                        type: 'address',
                        value: { kind: 'address', value: SIGNER },
                    },
                ],
            },
        })
        expect(vi.mocked(useEvmContractAbiQuery)).toHaveBeenLastCalledWith({
            scope: SCOPE,
            address: TARGET,
            isEnabled: true,
        })
    })

    it("carries a proxy's implementation", () => {
        answering({ data: verified([CLAIM], IMPLEMENTATION) })

        const result = render()

        expect(result.status === 'decoded' && result.call.proxy).toEqual({
            implementation: IMPLEMENTATION,
        })
    })

    it('is unrecognised when the contract is not verified', () => {
        answering({ data: { status: 'unverified' } })

        expect(render()).toEqual({ status: 'unrecognised' })
    })

    it("is unrecognised when the calldata doesn't decode exactly under the ABI", () => {
        answering({ data: verified([CLAIM]) })

        expect(render(viewWith({ data: `${CLAIM_DATA}00` }))).toEqual({
            status: 'unrecognised',
        })
    })

    it("says the lookup failed when the backend couldn't answer", () => {
        answering({ isError: true })

        expect(render()).toEqual({ status: 'lookup-failed' })
    })

    it('is loading while the lookup is in flight', () => {
        answering({ isPending: true })

        expect(render()).toEqual({ status: 'loading' })
    })

    it('stays idle when the scope offers no lookup', () => {
        answering({ data: { status: 'unavailable' } })

        expect(render()).toEqual({ status: 'idle' })
    })

    it('looks nothing up with contractDecoding off', () => {
        vi.mocked(useChainCapability).mockReturnValue(false)
        answering({ data: verified([CLAIM]) })

        expect(render()).toEqual({ status: 'idle' })
        expect(lookupEnabled()).toBe(false)
    })

    it('looks nothing up when the caller disables it', () => {
        answering({ data: verified([CLAIM]) })

        expect(render(viewWith(), false)).toEqual({ status: 'idle' })
        expect(lookupEnabled()).toBe(false)
    })

    it('leaves a standard token call to its own review', () => {
        const view = viewWith({
            call: {
                kind: 'approve',
                contract: TARGET,
                spender: SIGNER,
                value: new Decimal(1),
            },
        })

        expect(render(view)).toEqual({ status: 'idle' })
        expect(lookupEnabled()).toBe(false)
    })

    it("leaves a known contract's action to its own review", () => {
        const view = viewWith({
            knownContract: {
                kind: 'wrapped-native',
                name: 'Wrapped Ether',
            },
            action: { kind: 'wrap', amount: new Decimal(1) },
        })

        expect(render(view)).toEqual({ status: 'idle' })
        expect(lookupEnabled()).toBe(false)
    })

    it('looks nothing up for a contract creation', () => {
        expect(render(viewWith({ to: undefined }))).toEqual({ status: 'idle' })
        expect(lookupEnabled()).toBe(false)
    })

    it('looks nothing up for calldata shorter than a selector', () => {
        expect(
            render(viewWith({ data: '0xd0e3', selector: undefined })),
        ).toEqual({ status: 'idle' })
        expect(lookupEnabled()).toBe(false)
    })

    it('looks nothing up for a plain transfer', () => {
        expect(render(viewWith({ kind: 'transfer', data: '0x' }))).toEqual({
            status: 'idle',
        })
        expect(lookupEnabled()).toBe(false)
    })

    it('stays idle without a view', () => {
        expect(render(null)).toEqual({ status: 'idle' })
        expect(lookupEnabled()).toBe(false)
    })
})
