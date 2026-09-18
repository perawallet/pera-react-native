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
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ABIType, decodeAddress, encodeAddress } from 'algosdk'

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
// resolveEscrowChainConfig reads the network config; the rest of the escrow
// barrel it comes through still wants the real `config` object.
vi.mock('@perawallet/wallet-core-config', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-config')),
    getNetworkConfig,
}))

import { useEscrowWithdrawal } from '../useEscrowWithdrawal'

const CARD = 'PWJLR77JXPCJDWUCGB7MXGH2AFXAFU6UE7FNZLRLSEXJNP6MKJMIXGWT4I'
const OWNER = '72PKQDFQGGH6YPQTOFBCZJXBI3WX575H3SHSN7FD6QYHIZBP4KNZYSTIOI'
const WITHDRAWAL_REQUEST = ABIType.from(
    '(address,address,uint64,uint64,uint64,uint64)',
)

let paramsCall: Mock
let addAppCallMethodCall: Mock
let boxDo: Mock
let getGlobalValue: Mock

beforeEach(() => {
    vi.clearAllMocks()
    useNetwork.mockReturnValue({ network: 'testnet' })
    getNetworkConfig.mockReturnValue({
        cardW3CardAppId: '769896880',
        cardKillswitchAppId: '769896907',
        cardUsdcAssetId: '10458941',
    })
    paramsCall = vi.fn(async ({ method }: { method: string }) => ({ method }))
    addAppCallMethodCall = vi.fn()
    boxDo = vi.fn()
    getGlobalValue = vi.fn(async () => 20n)
    useAlgorandClient.mockReturnValue({
        newGroup: () => ({
            addAppCallMethodCall,
            build: vi.fn(async () => ({
                atc: { buildGroup: () => [{ txn: { id: 'txn-1' } }] },
            })),
        }),
        client: {
            algod: {
                getApplicationBoxByName: vi.fn(() => ({ do: boxDo })),
            },
            getAppClientById: vi.fn(() => ({
                params: { call: paramsCall },
                state: { global: { getValue: getGlobalValue } },
            })),
        },
    })
})

describe('useEscrowWithdrawal', () => {
    it('buildRequest calls withdrawalRequest(card, asset, amount) with the card named', async () => {
        const { result } = renderHook(() => useEscrowWithdrawal())

        const txns = await result.current.buildRequest({
            sender: OWNER,
            cardAddress: CARD,
            amount: 100_000n,
        })

        expect(paramsCall).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'withdrawalRequest',
                args: [CARD, 10_458_941n, 100_000n],
                accountReferences: [CARD],
                assetReferences: [10_458_941n],
            }),
        )
        expect(addAppCallMethodCall).toHaveBeenCalledWith({
            method: 'withdrawalRequest',
        })
        expect(txns).toEqual([{ id: 'txn-1' }])
    })

    // withdraw issues an inner asset transfer from the card to its owner, so
    // the outer call has to carry one extra minimum fee.
    it('buildWithdraw calls withdraw(card, amount) with an extra fee for the inner transfer', async () => {
        const { result } = renderHook(() => useEscrowWithdrawal())

        await result.current.buildWithdraw({
            sender: OWNER,
            cardAddress: CARD,
            amount: 100_000n,
        })

        const params = paramsCall.mock.calls[0][0]
        expect(params).toEqual(
            expect.objectContaining({
                method: 'withdraw',
                args: [CARD, 100_000n],
                accountReferences: [CARD],
            }),
        )
        expect(params.extraFee.microAlgo).toBe(1000n)
    })

    it('buildCancel calls withdrawalCancel(card)', async () => {
        const { result } = renderHook(() => useEscrowWithdrawal())

        await result.current.buildCancel({ sender: OWNER, cardAddress: CARD })

        expect(paramsCall).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'withdrawalCancel',
                args: [CARD],
            }),
        )
    })

    it('decodes the pending request from the withdrawals box keyed by the card', async () => {
        boxDo.mockResolvedValue({
            value: WITHDRAWAL_REQUEST.encode([
                CARD,
                OWNER,
                10_458_941n,
                100_000n,
                1_700_000_000n,
                3n,
            ]),
        })
        const { result } = renderHook(() => useEscrowWithdrawal())

        const pending = await result.current.getPendingWithdrawal(CARD)

        expect(pending).toEqual({
            card: CARD,
            recipient: OWNER,
            asset: '10458941',
            amount: 100_000n,
            createdAt: 1_700_000_000,
            nonce: 3n,
        })
        const [appId, boxName] =
            useAlgorandClient.mock.results[0].value.client.algod
                .getApplicationBoxByName.mock.calls[0]
        expect(appId).toBe(769_896_880n)
        expect(new TextDecoder().decode(boxName.subarray(0, 2))).toBe('wr')
        expect(encodeAddress(boxName.subarray(2))).toBe(CARD)
        expect(boxName.length).toBe(2 + decodeAddress(CARD).publicKey.length)
    })

    it('treats a missing box as no pending request but rethrows anything else', async () => {
        const { result } = renderHook(() => useEscrowWithdrawal())

        boxDo.mockRejectedValueOnce({ status: 404 })
        await expect(
            result.current.getPendingWithdrawal(CARD),
        ).resolves.toBeNull()

        boxDo.mockRejectedValueOnce(new Error('algod down'))
        await expect(result.current.getPendingWithdrawal(CARD)).rejects.toThrow(
            'algod down',
        )
    })

    it('reads withdrawal_wait_time as seconds and reports null when unset', async () => {
        const { result } = renderHook(() => useEscrowWithdrawal())

        await expect(result.current.getWaitTimeSeconds()).resolves.toBe(20)
        expect(getGlobalValue).toHaveBeenCalledWith('withdrawal_wait_time')

        getGlobalValue.mockResolvedValueOnce(undefined)
        await expect(result.current.getWaitTimeSeconds()).resolves.toBeNull()
    })
})
