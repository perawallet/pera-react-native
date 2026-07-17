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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, toPromise } from 'xstate'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...original,
        useNetworkStore: { getState: () => ({ network: 'testnet' }) },
    }
})

import { transportActor, type TransportActorInput } from '../transportActor'
import { createTransportSelector } from '../../../../pipeline/transports/getTransport'
import type { SigningResult, SourceMetadata } from '../../../../pipeline/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const MOCK_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

// Minimal mock account (algo25, local signing keys)
const mockAlgo25Account: WalletAccount = {
    type: 'algo25',
    address: MOCK_ADDRESS,
    keyPairId: 'key-1',
} as unknown as WalletAccount

const mockSigningResult: SigningResult = {
    signedData: {
        type: 'transactions',
        signed: [],
    },
    signers: [{ address: MOCK_ADDRESS }],
}

// algosdk's builder shape: sendRawTransaction(...).do() does the network call.
const mockSendRawDo = vi.fn().mockResolvedValue({ txid: 'mock-tx-id' })
const mockAlgokit = {
    client: {
        algod: {
            sendRawTransaction: vi.fn(() => ({ do: mockSendRawDo })),
        },
    },
}

const mockEncodeSignedTransactions = vi
    .fn()
    .mockReturnValue([new Uint8Array([1, 2, 3])])
const mockAddSignatures = vi.fn()

const makeInput = (
    source: SourceMetadata,
    overrides?: Partial<TransportActorInput>,
): TransportActorInput => ({
    signingResults: [mockSigningResult],
    source,
    signerAddress: MOCK_ADDRESS,
    allAccounts: [mockAlgo25Account],
    createTransport: createTransportSelector({
        algokit: mockAlgokit,
        encodeSignedTransactions: mockEncodeSignedTransactions,
        network: 'testnet',
    }),
    ...overrides,
})

describe('transportActor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAlgokit.client.algod.sendRawTransaction.mockReturnValue({
            do: mockSendRawDo,
        })
        mockSendRawDo.mockResolvedValue({ txid: 'mock-tx-id' })
    })

    it('routes to algod transport for local source', async () => {
        const source: SourceMetadata = { type: 'local' }
        const actor = createActor(transportActor, { input: makeInput(source) })
        actor.start()
        const result = await toPromise(actor)

        expect(result.type).toBe('submitted')
        expect(
            mockAlgokit.client.algod.sendRawTransaction,
        ).toHaveBeenCalledOnce()
    })

    it('routes to WalletConnect transport for walletconnect source', async () => {
        const approveMock = vi.fn().mockResolvedValue(undefined)
        const source: SourceMetadata = {
            type: 'walletconnect',
            requestId: 'req-1',
            callbacks: { approve: approveMock },
        }
        const actor = createActor(transportActor, { input: makeInput(source) })
        actor.start()
        const result = await toPromise(actor)

        expect(result.type).toBe('callback-sent')
        expect(approveMock).toHaveBeenCalledWith(mockSigningResult)
    })

    it('routes to multisig cosign transport for multisig-cosign source', async () => {
        mockAddSignatures.mockResolvedValue({ status: 'pending' })
        const source: SourceMetadata = {
            type: 'multisig-cosign',
            signRequestId: 'sign-req-1',
        }
        const input = makeInput(source, {
            createTransport: createTransportSelector({
                algokit: mockAlgokit,
                encodeSignedTransactions: mockEncodeSignedTransactions,
                addSignatures: mockAddSignatures,
                network: 'testnet',
            }),
        })
        const actor = createActor(transportActor, { input })
        actor.start()
        const result = await toPromise(actor)

        expect(result.type).toBe('signatures-added')
        expect(mockAddSignatures).toHaveBeenCalledWith({
            signRequestId: 'sign-req-1',
            signers: mockSigningResult.signers,
        })
    })

    it('throws when algod sendRawTransaction fails', async () => {
        mockSendRawDo.mockRejectedValue(new Error('network error'))
        const source: SourceMetadata = { type: 'local' }
        const actor = createActor(transportActor, { input: makeInput(source) })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow('network error')
    })

    it('throws when WalletConnect approve callback is missing', async () => {
        const source: SourceMetadata = {
            type: 'walletconnect',
            requestId: 'req-1',
            // no callbacks
        }
        const actor = createActor(transportActor, { input: makeInput(source) })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow()
    })

    it('throws when signerAddress is not found in allAccounts', async () => {
        const source: SourceMetadata = { type: 'local' }
        const actor = createActor(transportActor, {
            input: { ...makeInput(source), allAccounts: [] },
        })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow(/not found/)
    })

    it('keys the multisig propose on the resolved auth account when the sender is a rekeyed shared account', async () => {
        // A shared account (J1) rekeyed to another shared account (J2). The
        // transaction's sender is J1, but its on-chain auth is J2, so the
        // multisig must be assembled from J2's template — the propose must be
        // keyed on J2's address, not the sender J1's.
        const J1_ADDRESS =
            'G3EG2YQE72G52LIV5AHOA5VEVM7AFT2BFKOSZXJIJBDHBSBPXPTZC5OM24'
        const J2_ADDRESS =
            'PZIKED6CFGYIWFYTD4H4XJBAGGNAVTQ7G67DLQWERF6BVZAB3WH27LBHUI'
        const jointSender = {
            type: 'multisig',
            address: J1_ADDRESS,
            rekeyAddress: J2_ADDRESS,
            multisigDetails: {
                threshold: 2,
                addresses: ['p1', 'p2'],
                version: 1,
            },
        } as unknown as WalletAccount
        const authAccount = {
            type: 'multisig',
            address: J2_ADDRESS,
            multisigDetails: {
                threshold: 2,
                addresses: ['p3', 'p4'],
                version: 1,
            },
        } as unknown as WalletAccount

        const proposeMock = vi
            .fn()
            .mockResolvedValue({ signRequestId: 'sr-1', status: 'pending' })

        const input = makeInput(
            { type: 'local' },
            {
                signerAddress: J1_ADDRESS,
                allAccounts: [jointSender, authAccount],
                createTransport: createTransportSelector({
                    algokit: mockAlgokit,
                    encodeSignedTransactions: mockEncodeSignedTransactions,
                    network: 'testnet',
                    proposeSignRequest: proposeMock,
                    getMsigMetadata: () => undefined,
                    getDeviceId: () => 'device-1',
                }),
            },
        )
        const actor = createActor(transportActor, { input })
        actor.start()
        await toPromise(actor)

        expect(proposeMock).toHaveBeenCalledWith(
            expect.objectContaining({ multisigAddress: J2_ADDRESS }),
        )
    })

    it('routes a local-key sender rekeyed to a multisig auth to the propose transport keyed on the auth', async () => {
        // Sender is a standard account whose on-chain auth is a Pera-held
        // multisig (external rekey / watch-import). The auth's template
        // authorizes the transaction, so the transport must be the multisig
        // propose keyed on the auth address — not a direct algod submit
        // keyed on the sender's own (standard) type.
        const MSIG_AUTH_ADDRESS =
            'PZIKED6CFGYIWFYTD4H4XJBAGGNAVTQ7G67DLQWERF6BVZAB3WH27LBHUI'
        const rekeyedSender = {
            ...mockAlgo25Account,
            rekeyAddress: MSIG_AUTH_ADDRESS,
        } as unknown as WalletAccount
        const msigAuth = {
            type: 'multisig',
            address: MSIG_AUTH_ADDRESS,
            multisigDetails: {
                threshold: 2,
                addresses: ['p1', 'p2'],
                version: 1,
            },
        } as unknown as WalletAccount

        const proposeMock = vi
            .fn()
            .mockResolvedValue({ signRequestId: 'sr-2', status: 'pending' })

        const input = makeInput(
            { type: 'local' },
            {
                allAccounts: [rekeyedSender, msigAuth],
                createTransport: createTransportSelector({
                    algokit: mockAlgokit,
                    encodeSignedTransactions: mockEncodeSignedTransactions,
                    network: 'testnet',
                    proposeSignRequest: proposeMock,
                    getMsigMetadata: () => undefined,
                    getDeviceId: () => 'device-1',
                }),
            },
        )
        const actor = createActor(transportActor, { input })
        actor.start()
        await toPromise(actor)

        expect(proposeMock).toHaveBeenCalledWith(
            expect.objectContaining({ multisigAddress: MSIG_AUTH_ADDRESS }),
        )
        expect(
            mockAlgokit.client.algod.sendRawTransaction,
        ).not.toHaveBeenCalled()
    })

    it('keys the cosign transport on the participant itself even when the participant is rekeyed', async () => {
        // Multisig-cosign participants sign with their own key — the rekey
        // hop must not be followed for transport keying either.
        mockAddSignatures.mockResolvedValue({ status: 'pending' })
        const rekeyedParticipant = {
            ...mockAlgo25Account,
            rekeyAddress: 'SOMEOTHERAUTH',
        } as unknown as WalletAccount
        const source: SourceMetadata = {
            type: 'multisig-cosign',
            signRequestId: 'sign-req-2',
        }
        const input = makeInput(source, {
            allAccounts: [rekeyedParticipant],
            createTransport: createTransportSelector({
                algokit: mockAlgokit,
                encodeSignedTransactions: mockEncodeSignedTransactions,
                addSignatures: mockAddSignatures,
                network: 'testnet',
            }),
        })
        const actor = createActor(transportActor, { input })
        actor.start()
        const result = await toPromise(actor)

        expect(result.type).toBe('signatures-added')
        expect(mockAddSignatures).toHaveBeenCalledWith({
            signRequestId: 'sign-req-2',
            signers: mockSigningResult.signers,
        })
    })
})
