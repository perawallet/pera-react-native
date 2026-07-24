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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import {
    FeeDelegationAttestationRequiredError,
    FeeDelegationResponseMismatchError,
} from '../../errors'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const {
    addSignRequestMock,
    submitAndAutoRefreshMock,
    getAppIntegrityStateMock,
    requestFeeDelegationMock,
    configFlags,
} = vi.hoisted(() => ({
    addSignRequestMock: vi.fn(),
    submitAndAutoRefreshMock: vi.fn(),
    getAppIntegrityStateMock: vi.fn(),
    requestFeeDelegationMock: vi.fn(),
    configFlags: { isDev: false, isStaging: false },
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        get isDev() {
            return configFlags.isDev
        },
        get isStaging() {
            return configFlags.isStaging
        },
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({ kind: 'algokit-client' }),
    useNetwork: () => ({ network: 'mainnet' }),
    // Order-sensitive byte match; with deterministic base64 inputs, comparing
    // the encoded strings is equivalent to the real decode-and-compare.
    rawTransactionsMatch: (expected: string[], polled: string[]) =>
        expected.length === polled.length &&
        expected.every((value, index) => value === polled[index]),
    useTransactionEncoder: () => ({
        encodeTransaction: (txn: { id: string }) =>
            new Uint8Array([...txn.id].map(c => c.charCodeAt(0))),
        encodeSignedTransactions: vi.fn(),
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
            txn: { id: String.fromCharCode(...bytes) },
        }),
    }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: addSignRequestMock }),
    submitAndAutoRefresh: submitAndAutoRefreshMock,
}))

vi.mock('@perawallet/wallet-core-app-integrity', () => ({
    useAppIntegrityStore: { getState: () => getAppIntegrityStateMock() },
}))

vi.mock('../../api', () => ({
    requestFeeDelegation: (...args: unknown[]) =>
        requestFeeDelegationMock(...args),
}))

import { useFeeDelegation } from '../useFeeDelegation'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const ACCOUNT = 'TESTADDRESS'
const ASSET_ID = 31566704n

// Inputs are ASCII, so btoa is byte-exact and needs no Node Buffer global.
const toBase64 = (text: string) => btoa(text)

const validAttestation = () => ({
    integrityToken: 'valid-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
})

const baseParams = {
    account: ACCOUNT,
    // Sender matches the encoder/decoder shape so the trust-anchor check can
    // assert the returned slot is byte-identical (modulo group) to this txn.
    transactions: [
        { id: 'optin', sender: { toString: () => ACCOUNT } },
    ] as never[],
    includeMbr: true,
    optInAssetIds: [ASSET_ID],
    sourceMetadata: { name: 'test-flow', description: 'Test flow' },
}

function renderDelegation() {
    return renderHook(() => useFeeDelegation()).result
}

beforeEach(() => {
    vi.clearAllMocks()
    getAppIntegrityStateMock.mockReturnValue(validAttestation())
    configFlags.isDev = false
    configFlags.isStaging = false
})

describe('fee-delegation/useFeeDelegation', () => {
    test('rejects with FeeDelegationAttestationRequiredError when no token is stored', async () => {
        getAppIntegrityStateMock.mockReturnValue({
            integrityToken: null,
            expiresAt: null,
        })

        const result = renderDelegation()

        await expect(
            result.current.submitWithFeeDelegation(baseParams),
        ).rejects.toBeInstanceOf(FeeDelegationAttestationRequiredError)
        expect(requestFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('rejects when the stored token has expired', async () => {
        getAppIntegrityStateMock.mockReturnValue({
            integrityToken: 'stale-token',
            expiresAt: new Date(Date.now() - 1_000).toISOString(),
        })

        const result = renderDelegation()

        await expect(
            result.current.submitWithFeeDelegation(baseParams),
        ).rejects.toBeInstanceOf(FeeDelegationAttestationRequiredError)
        expect(requestFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('proceeds without a token on a development build, since attestation is skipped there', async () => {
        configFlags.isDev = true
        getAppIntegrityStateMock.mockReturnValue({
            integrityToken: null,
            expiresAt: null,
        })
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
            void request.approve([{ kind: 'signed', txn: { id: 'optin' } }])
        })

        const result = renderDelegation()
        await result.current.submitWithFeeDelegation(baseParams)

        expect(requestFeeDelegationMock).toHaveBeenCalledWith(
            expect.any(Object),
            '',
            'mainnet',
        )
    })

    test('proceeds without a token on a staging build, since attestation may not be ready yet', async () => {
        configFlags.isStaging = true
        getAppIntegrityStateMock.mockReturnValue({
            integrityToken: null,
            expiresAt: null,
        })
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
            void request.approve([{ kind: 'signed', txn: { id: 'optin' } }])
        })

        const result = renderDelegation()
        await result.current.submitWithFeeDelegation(baseParams)

        expect(requestFeeDelegationMock).toHaveBeenCalledWith(
            expect.any(Object),
            '',
            'mainnet',
        )
    })

    test('sends the encoded group with the token, signs the wallet slot, and submits in order', async () => {
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

        addSignRequestMock.mockImplementation(request => {
            callOrder.push('sign')
            // The pipeline returns one signed txn per unsigned slot.
            void request.approve([{ kind: 'signed', txn: { id: 'optin' } }])
        })

        submitAndAutoRefreshMock.mockImplementation(async () => {
            callOrder.push('submit')
            return ['submitted-tx']
        })

        const result = renderDelegation()
        await result.current.submitWithFeeDelegation(baseParams)

        // Request: base64 of the unsigned opt-in + MBR + asset id as string,
        // authenticated with the attestation token, on the active network.
        expect(requestFeeDelegationMock).toHaveBeenCalledWith(
            {
                txnGroup: [{ txn: toBase64('optin') }],
                account: ACCOUNT,
                includeMbr: true,
                optInAssetIds: [ASSET_ID.toString()],
            },
            'valid-token',
            'mainnet',
        )

        // Signing: only the unsigned slot (index 1 of the re-grouped payload)
        // is signable; the full group is the integrity context.
        expect(addSignRequestMock).toHaveBeenCalledTimes(1)
        const signRequest = addSignRequestMock.mock.calls[0]![0]
        expect(signRequest.signableIndices).toEqual([1])
        expect(signRequest.txs.map((tx: { id: string }) => tx.id)).toEqual([
            'optin',
        ])
        expect(
            signRequest.groupContext.map((tx: { id: string }) => tx.id),
        ).toEqual(['sponsor', 'optin'])
        expect(signRequest.sourceMetadata).toEqual(baseParams.sourceMetadata)

        // Submission: sponsor's pre-signed slot first, wallet signature after,
        // and the steps ran request → sign → submit.
        expect(submitAndAutoRefreshMock).toHaveBeenCalledTimes(1)
        const orderedSigned = submitAndAutoRefreshMock.mock.calls[0]![2]
        expect(orderedSigned).toEqual([
            { sig: new Uint8Array([9]), txn: { id: 'sponsor' } },
            { kind: 'signed', txn: { id: 'optin' } },
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
