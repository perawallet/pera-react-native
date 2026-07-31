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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { generateAccount } from 'algosdk'

const { useAlgorandClient, useNetwork } = vi.hoisted(() => ({
    useAlgorandClient: vi.fn(),
    useNetwork: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient,
    useNetwork,
    FALLBACK_MIN_TXN_FEE: 1000n,
}))
vi.mock('@algorandfoundation/algokit-utils', () => ({
    // Identity passthrough: the "populated" ATC is the one build() returned.
    populateAppCallResources: vi.fn(async (atc: unknown) => atc),
}))

const { getNetworkConfig } = vi.hoisted(() => ({ getNetworkConfig: vi.fn() }))
vi.mock('@perawallet/wallet-core-config', () => ({ getNetworkConfig }))

import {
    useKillswitchAutoDraw,
    isKillswitchConfigured,
} from '../useKillswitchAutoDraw'

const APP_ADDRESS = 'KILLSWITCHAPPADDR'
const ENABLE_CALL = { method: 'enable' }
const KILL_CALL = { method: 'kill' }

let addPayment: Mock
let addAppCallMethodCall: Mock
let paramsCall: Mock
let boxDo: Mock

beforeEach(() => {
    vi.clearAllMocks()
    useNetwork.mockReturnValue({ network: 'testnet' })
    getNetworkConfig.mockReturnValue({ cardKillswitchAppId: '222' })

    addPayment = vi.fn()
    paramsCall = vi
        .fn()
        .mockImplementation(async ({ method }: { method: string }) =>
            method === 'enable' ? ENABLE_CALL : KILL_CALL,
        )
    addAppCallMethodCall = vi.fn()
    boxDo = vi.fn(async () => ({
        name: new Uint8Array(),
        value: new Uint8Array(),
    }))

    const composer = {
        addPayment,
        addAppCallMethodCall,
        build: vi.fn(async () => ({
            atc: { buildGroup: () => [{ txn: { id: 'txn-1' } }] },
        })),
    }
    useAlgorandClient.mockReturnValue({
        newGroup: () => composer,
        getSuggestedParams: vi.fn(async () => ({ minFee: 1000n })),
        client: {
            algod: {
                getApplicationBoxByName: vi.fn(() => ({ do: boxDo })),
            },
            getAppClientById: vi.fn(() => ({
                appAddress: APP_ADDRESS,
                params: { call: paramsCall },
            })),
        },
    })
})

describe('isKillswitchConfigured', () => {
    it('is false for the empty / placeholder app id, true for a real one', () => {
        getNetworkConfig.mockReturnValue({ cardKillswitchAppId: '' })
        expect(isKillswitchConfigured('testnet')).toBe(false)
        getNetworkConfig.mockReturnValue({ cardKillswitchAppId: '0' })
        expect(isKillswitchConfigured('testnet')).toBe(false)
        getNetworkConfig.mockReturnValue({ cardKillswitchAppId: '222' })
        expect(isKillswitchConfigured('testnet')).toBe(true)
    })
})

describe('useKillswitchAutoDraw', () => {
    it('buildEnable calls enable(card, asset) fee-delegation-ready (simulate fee stripped, no self-funding)', async () => {
        const { result } = renderHook(() => useKillswitchAutoDraw())

        const txns = await result.current.buildEnable({
            sender: 'SENDER',
            cardAddress: 'CARD',
            asset: '10458941',
        })

        // No self-funded MBR payment: the accounts-box MBR is funded by the
        // Killswitch app account, and the group's fees by the sponsor.
        expect(addPayment).not.toHaveBeenCalled()
        expect(paramsCall).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'enable',
                args: ['CARD', 10458941n],
            }),
        )
        // The build carries a simulate-only fee (call + one inner txn) so the
        // resource-population simulate passes algod's min-fee validation...
        expect(paramsCall.mock.calls[0][0].staticFee.microAlgo).toBe(2000n)
        expect(addAppCallMethodCall).toHaveBeenCalledWith(ENABLE_CALL)
        // ...but the returned txns are zero-fee and ungrouped: the
        // fee-delegation sponsor pays, and the backend re-groups.
        expect(txns).toEqual([{ id: 'txn-1', fee: 0n, group: undefined }])
    })

    it('buildKill calls kill(asset) with no funding and no extra fee', async () => {
        const { result } = renderHook(() => useKillswitchAutoDraw())

        const txns = await result.current.buildKill({
            sender: 'SENDER',
            asset: '10458941',
        })

        expect(addPayment).not.toHaveBeenCalled()
        expect(paramsCall).toHaveBeenCalledWith({
            method: 'kill',
            args: [10458941n],
        })
        expect(addAppCallMethodCall).toHaveBeenCalledWith(KILL_CALL)
        expect(txns).toEqual([{ id: 'txn-1' }])
    })

    describe('isAutoDrawEnabled', () => {
        // decodeAddress needs a real address; the box name is its raw pubkey
        // followed by the 8-byte big-endian asset id.
        const SENDER = generateAccount().addr.toString()

        it('is true when the sender has an accounts box for that asset', async () => {
            const { result } = renderHook(() => useKillswitchAutoDraw())
            await expect(
                result.current.isAutoDrawEnabled({
                    sender: SENDER,
                    asset: '10458941',
                }),
            ).resolves.toBe(true)
        })

        it('is false on the box-not-found 404', async () => {
            boxDo.mockRejectedValue(
                Object.assign(new Error('box not found'), {
                    response: { status: 404 },
                }),
            )
            const { result } = renderHook(() => useKillswitchAutoDraw())
            await expect(
                result.current.isAutoDrawEnabled({
                    sender: SENDER,
                    asset: '10458941',
                }),
            ).resolves.toBe(false)
        })

        it('rethrows non-404 errors instead of reading them as disabled', async () => {
            boxDo.mockRejectedValue(new Error('network down'))
            const { result } = renderHook(() => useKillswitchAutoDraw())
            await expect(
                result.current.isAutoDrawEnabled({
                    sender: SENDER,
                    asset: '10458941',
                }),
            ).rejects.toThrow('network down')
        })
    })
})
