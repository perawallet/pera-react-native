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

// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import {
    FeeDelegationAttestationRequiredError,
    FeeDelegationResponseMismatchError,
} from '../../errors'

const {
    addSignRequestMock,
    submitAndAutoRefreshMock,
    canCallIntegrityGuardedRouteMock,
    requestFeeDelegationMock,
} = vi.hoisted(() => ({
    addSignRequestMock: vi.fn(),
    submitAndAutoRefreshMock: vi.fn(),
    canCallIntegrityGuardedRouteMock: vi.fn(),
    requestFeeDelegationMock: vi.fn(),
}))

vi.mock('../../../blockchain', () => ({
    compactSignedResults: (signed: unknown[]) =>
        signed.filter(tx => tx !== null),
    // Order-sensitive byte match; with deterministic base64 inputs, comparing
    // the encoded strings is equivalent to the real decode-and-compare.
    rawTransactionsMatch: (expected: string[], polled: string[]) =>
        expected.length === polled.length &&
        expected.every((value, index) => value === polled[index]),
    useTransactionEncoder: () => ({
        // Mirrors the real pair: the signable form leads with the "TX" domain
        // separator, the wire form does not. Only the wire form goes to the
        // backend, so the ids assertions track come from the raw encoder.
        encodeTransaction: (txn: { id: string }) =>
            new Uint8Array([...`TX${txn.id}`].map(c => c.charCodeAt(0))),
        encodeTransactionRaw: (txn: { id: string }) =>
            new Uint8Array([...txn.id].map(c => c.charCodeAt(0))),
        encodeSignedTransaction: (signed: { txn: { id: string } }) =>
            new Uint8Array([...`S${signed.txn.id}`].map(c => c.charCodeAt(0))),
        // Decoders turn the base64-decoded bytes back into readable ids so
        // assertions can track slots through the flow. Decoded wallet slots
        // carry the requesting account as sender so the trust-anchor check
        // (sender === account) passes on the happy path.
        decodeTransaction: (bytes: Uint8Array) => ({
            id: String.fromCharCode(...bytes),
            sender: { toString: () => 'TESTADDRESS' },
        }),
        decodeSignedTransaction: (bytes: Uint8Array) => ({
            sig: new Uint8Array([9]),
            txn: {
                id: String.fromCharCode(...bytes),
                txID: () => `${String.fromCharCode(...bytes)}-id`,
                sender: { toString: () => 'SPONSOR' },
            },
        }),
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: addSignRequestMock }),
    submitAndAutoRefresh: submitAndAutoRefreshMock,
}))

// Token expiry and the dev/staging exemption belong to the integrity policy
// (unit-tested in the app-integrity package); the hook only branches on it.
vi.mock('@perawallet/wallet-core-app-integrity', () => ({
    canCallIntegrityGuardedRoute: canCallIntegrityGuardedRouteMock,
}))

vi.mock('../../api', () => ({
    requestFeeDelegation: (...args: unknown[]) =>
        requestFeeDelegationMock(...args),
}))

import { useFeeDelegation } from '../useFeeDelegation'

const ACCOUNT = 'TESTADDRESS'
const ASSET_ID = 31566704n

// Inputs are ASCII, so btoa is byte-exact and needs no Node Buffer global.
const toBase64 = (text: string) => btoa(text)

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const payloadIdOf = (unsigned: { payload: unknown }) =>
    (unsigned.payload as { transaction: { id: string } }).transaction.id

const baseParams = {
    account: ACCOUNT,
    // Sender matches the encoder/decoder shape so the trust-anchor check can
    // assert the returned slot is byte-identical (modulo group) to this txn.
    transactions: [
        {
            scope: SCOPE,
            payload: {
                transaction: {
                    id: 'optin',
                    sender: { toString: () => ACCOUNT },
                },
            },
            summary: {
                kind: 'chain-specific',
                title: { key: 'opt_in' },
                direction: 'none',
                icon: 'opt-in',
            },
            chainData: { family: 'algorand' },
        },
    ] as never[],
    includeAssetOptInMbr: true,
    optInAssetIds: [ASSET_ID],
    sourceMetadata: { name: 'test-flow', description: 'Test flow' },
}

function renderDelegation() {
    return renderHook(() => useFeeDelegation()).result
}

beforeEach(() => {
    vi.clearAllMocks()
    canCallIntegrityGuardedRouteMock.mockReturnValue(true)
})

describe('fee-delegation/useFeeDelegation', () => {
    test('rejects with FeeDelegationAttestationRequiredError when the guarded route would refuse', async () => {
        canCallIntegrityGuardedRouteMock.mockReturnValue(false)

        const result = renderDelegation()

        await expect(
            result.current.submitWithFeeDelegation(baseParams),
        ).rejects.toBeInstanceOf(FeeDelegationAttestationRequiredError)
        expect(requestFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('sends the encoded group, signs the wallet slot, and submits in order', async () => {
        const callOrder: string[] = []

        // Sponsor slot (signed, first) + the wallet's opt-in slot (unsigned).
        requestFeeDelegationMock.mockImplementation(async () => {
            callOrder.push('request')
            return {
                txnGroup: [
                    {
                        txn: toBase64('sponsor'),
                        signers: [],
                        stxn: toBase64('sponsor'),
                    },
                    { txn: toBase64('optin'), signers: [ACCOUNT] },
                ],
            }
        })

        const walletSigned = {
            scope: SCOPE,
            id: 'optin-id',
            bytes: new Uint8Array([1]),
        }
        addSignRequestMock.mockImplementation(request => {
            callOrder.push('sign')
            // The pipeline returns one signed txn per unsigned slot.
            void request.approve([walletSigned])
        })

        submitAndAutoRefreshMock.mockImplementation(async () => {
            callOrder.push('submit')
            return ['submitted-tx']
        })

        const result = renderDelegation()
        await result.current.submitWithFeeDelegation(baseParams)

        // Request: base64 of the unsigned opt-in + MBR + asset id as string,
        // on the active network.
        expect(requestFeeDelegationMock).toHaveBeenCalledWith(
            {
                // 'optin', not 'TXoptin': ARC-0001 carries the prefix-free wire
                // form. Sending the signable bytes fails the backend decoder.
                txnGroup: [{ txn: toBase64('optin') }],
                account: ACCOUNT,
                includeAssetOptInMbr: true,
                optInAssetIds: [ASSET_ID.toString()],
            },
            'mainnet',
        )

        // Signing: only the unsigned slot (index 1 of the re-grouped payload)
        // is signable; the full group is the integrity context.
        expect(addSignRequestMock).toHaveBeenCalledTimes(1)
        const signRequest = addSignRequestMock.mock.calls[0]![0]
        expect(signRequest).not.toHaveProperty('chainId')
        expect(signRequest.chainData.algorand.signableIndices).toEqual([1])
        expect(signRequest.txs.map(payloadIdOf)).toEqual(['optin'])
        expect(signRequest.txs[0].scope).toEqual(SCOPE)
        expect(
            signRequest.chainData.algorand.groupContext.map(payloadIdOf),
        ).toEqual(['sponsor', 'optin'])
        expect(signRequest.sourceMetadata).toEqual(baseParams.sourceMetadata)

        // Submission: sponsor's pre-signed slot first, wallet signature after,
        // and the steps ran request → sign → submit.
        expect(submitAndAutoRefreshMock).toHaveBeenCalledTimes(1)
        const [scope, orderedSigned] = submitAndAutoRefreshMock.mock.calls[0]!
        expect(scope).toEqual({ chainId: 'algorand', networkId: 'mainnet' })
        // The sponsor's slot is re-encoded from its decoded envelope.
        expect(orderedSigned).toEqual([
            {
                scope: SCOPE,
                id: 'sponsor-id',
                bytes: new Uint8Array(
                    [...'Ssponsor'].map(c => c.charCodeAt(0)),
                ),
            },
            walletSigned,
        ])
        expect(callOrder).toEqual(['request', 'sign', 'submit'])
    })

    test('a signing rejection propagates and nothing is submitted', async () => {
        requestFeeDelegationMock.mockResolvedValue({
            txnGroup: [
                {
                    txn: toBase64('sponsor'),
                    signers: [],
                    stxn: toBase64('sponsor'),
                },
                { txn: toBase64('optin'), signers: [ACCOUNT] },
            ],
        })
        addSignRequestMock.mockImplementation(request => {
            void request.reject()
        })

        const result = renderDelegation()

        await expect(
            result.current.submitWithFeeDelegation(baseParams),
        ).rejects.toThrow(/rejected/i)
        expect(submitAndAutoRefreshMock).not.toHaveBeenCalled()
    })

    test('rejects without signing when a returned to-sign slot does not match what was sent', async () => {
        // The backend swaps the wallet's opt-in for an attacker-favorable
        // transaction in the same slot. It must never reach the signing
        // pipeline or be submitted.
        requestFeeDelegationMock.mockResolvedValue({
            txnGroup: [
                {
                    txn: toBase64('sponsor'),
                    signers: [],
                    stxn: toBase64('sponsor'),
                },
                { txn: toBase64('drain-payment'), signers: [ACCOUNT] },
            ],
        })

        const result = renderDelegation()

        await expect(
            result.current.submitWithFeeDelegation(baseParams),
        ).rejects.toBeInstanceOf(FeeDelegationResponseMismatchError)
        expect(addSignRequestMock).not.toHaveBeenCalled()
        expect(submitAndAutoRefreshMock).not.toHaveBeenCalled()
    })
})
