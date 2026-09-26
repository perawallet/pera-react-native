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

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ABIType, decodeAddress, encodeAddress } from 'algosdk'

const { getAlgorandClient } = vi.hoisted(() => ({
    getAlgorandClient: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    getAlgorandClient,
    FALLBACK_MIN_TXN_FEE: 1000n,
}))
vi.mock('@algorandfoundation/algokit-utils', () => ({
    // Identity passthrough: the "populated" ATC is the one build() returned.
    populateAppCallResources: vi.fn(async (atc: unknown) => atc),
}))
const { getNetworkConfig } = vi.hoisted(() => ({ getNetworkConfig: vi.fn() }))
// resolveEscrowChainConfig reads the network config; everything else still
// wants the real `config` object.
vi.mock('@perawallet/wallet-core-config', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-config')),
    getNetworkConfig,
}))

import { algorandEscrowWithdrawals as withdrawals } from '../withdrawal'

const CARD = 'PWJLR77JXPCJDWUCGB7MXGH2AFXAFU6UE7FNZLRLSEXJNP6MKJMIXGWT4I'
const OWNER = '72PKQDFQGGH6YPQTOFBCZJXBI3WX575H3SHSN7FD6QYHIZBP4KNZYSTIOI'
const WITHDRAWAL_REQUEST = ABIType.from(
    '(address,address,uint64,uint64,uint64,uint64)',
)

let paramsCall: Mock
let addAppCallMethodCall: Mock
let boxDo: Mock
let getGlobalValue: Mock
let getApplicationBoxByName: Mock

beforeEach(() => {
    vi.clearAllMocks()
    getNetworkConfig.mockReturnValue({
        cardW3CardAppId: '769896880',
        cardKillswitchAppId: '769896907',
        cardUsdcAssetId: '10458941',
    })
    paramsCall = vi.fn(async ({ method }: { method: string }) => ({ method }))
    addAppCallMethodCall = vi.fn()
    boxDo = vi.fn()
    getGlobalValue = vi.fn(async () => 20n)
    getApplicationBoxByName = vi.fn(() => ({ do: boxDo }))
    getAlgorandClient.mockReturnValue({
        setDefaultValidityWindow: vi.fn(),
        setDefaultSigner: vi.fn(),
        newGroup: () => ({
            addAppCallMethodCall,
            build: vi.fn(async () => ({
                atc: { buildGroup: () => [{ txn: { id: 'txn-1' } }] },
            })),
        }),
        client: {
            algod: {
                getApplicationBoxByName,
            },
            getAppClientById: vi.fn(() => ({
                params: { call: paramsCall },
                state: { global: { getValue: getGlobalValue } },
            })),
        },
    })
})

describe('algorandEscrowWithdrawals', () => {
    it('buildRequest calls withdrawalRequest(card, asset, amount) with the card named', async () => {
        const txns = await withdrawals.buildRequest({
            network: 'testnet',
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
        await withdrawals.buildWithdraw({
            network: 'testnet',
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
        await withdrawals.buildCancel({
            network: 'testnet',
            sender: OWNER,
            cardAddress: CARD,
        })

        expect(paramsCall).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'withdrawalCancel',
                args: [CARD],
            }),
        )
    })

    it('decodes the pending request from the withdrawals box keyed by the owner', async () => {
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
        const pending = await withdrawals.getPending('testnet', OWNER)

        expect(pending).toEqual({
            card: CARD,
            recipient: OWNER,
            asset: '10458941',
            amount: 100_000n,
            createdAt: 1_700_000_000,
            nonce: 3n,
        })
        const [appId, boxName] = getApplicationBoxByName.mock.calls[0]
        expect(appId).toBe(769_896_880n)
        expect(new TextDecoder().decode(boxName.subarray(0, 2))).toBe('wr')
        expect(encodeAddress(boxName.subarray(2))).toBe(OWNER)
        expect(boxName.length).toBe(2 + decodeAddress(OWNER).publicKey.length)
    })

    it('treats a missing box as no pending request but rethrows anything else', async () => {
        boxDo.mockRejectedValueOnce({ status: 404 })
        await expect(
            withdrawals.getPending('testnet', OWNER),
        ).resolves.toBeNull()

        boxDo.mockRejectedValueOnce(new Error('algod down'))
        await expect(withdrawals.getPending('testnet', OWNER)).rejects.toThrow(
            'algod down',
        )
    })

    it('reads withdrawal_wait_time as seconds and reports null when unset', async () => {
        await expect(withdrawals.getWaitTimeSeconds('testnet')).resolves.toBe(
            20,
        )
        expect(getGlobalValue).toHaveBeenCalledWith('withdrawal_wait_time')

        getGlobalValue.mockResolvedValueOnce(undefined)
        await expect(
            withdrawals.getWaitTimeSeconds('testnet'),
        ).resolves.toBeNull()
    })
})
