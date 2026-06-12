/*
 Copyright 2022-2025 Pera Wallet, LDA
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

import { FeeDelegationAttestationRequiredError } from '../../errors'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const {
    addSignRequestMock,
    submitAndAutoRefreshMock,
    getAppIntegrityStateMock,
    requestFeeDelegationMock,
} = vi.hoisted(() => ({
    addSignRequestMock: vi.fn(),
    submitAndAutoRefreshMock: vi.fn(),
    getAppIntegrityStateMock: vi.fn(),
    requestFeeDelegationMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({ kind: 'algokit-client' }),
    useNetwork: () => ({ network: 'mainnet' }),
    useTransactionEncoder: () => ({
        encodeTransaction: (txn: { id: string }) =>
            new Uint8Array([...txn.id].map(c => c.charCodeAt(0))),
        encodeSignedTransactions: vi.fn(),
        // Decoders turn the base64-decoded bytes back into readable ids so
        // assertions can track slots through the flow.
        decodeTransaction: (bytes: Uint8Array) => ({
            id: String.fromCharCode(...bytes),
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

const toBase64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')

const validAttestation = () => ({
    integrityToken: 'valid-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
})

const baseParams = {
    account: ACCOUNT,
    transactions: [{ id: 'optin' }] as never[],
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
        expect(signRequest.txs).toEqual([{ id: 'optin' }])
        expect(signRequest.groupContext).toEqual([
            { id: 'sponsor' },
            { id: 'optin' },
        ])
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
})
