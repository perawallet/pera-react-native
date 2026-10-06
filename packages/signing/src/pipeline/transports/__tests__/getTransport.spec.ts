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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createTransportSelector } from '../getTransport'
import {
    algodBackedTransport,
    registerFakeBroadcaster,
} from '../../../__tests__/fakeBroadcaster'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    SigningResult,
    SignedTransactionData,
    SourceMetadata,
} from '../../types'
import type { DataTransport } from '../../types'
import { registerFakePlannerAdapter } from '../../../__tests__/fakePlannerAdapter'

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetworkStore: {
        getState: () => ({ network: 'testnet' }),
        subscribe: () => () => {},
    },
}))

const algo25Account: WalletAccount = {
    type: 'algo25',
    address: 'ADDR',
    keyPairId: 'key-1',
} as WalletAccount

const multisigAccount: WalletAccount = {
    type: 'multisig',
    address: 'MSIG',
    multisigDetails: {
        version: 1,
        threshold: 2,
        addresses: ['A', 'B'],
    },
} as unknown as WalletAccount

const MSIG_METADATA = {
    version: 1,
    threshold: 2,
    addresses: ['A', 'B'],
}

const baseOptions = () => ({
    network: 'testnet' as const,
    getMsigMetadata: () => MSIG_METADATA,
    getDeviceId: () => 'device-1',
})

const stubResult: SigningResult = {
    signedData: {
        type: 'transactions',
        signed: [{ txn: {} as never, blob: new Uint8Array() } as never],
    } as SignedTransactionData,
    signers: [{ address: 'ADDR' }],
}

describe('createTransportSelector', () => {
    const proposeTransport: DataTransport = { send: vi.fn() }
    const cosignTransport: DataTransport = { send: vi.fn() }
    let planner: ReturnType<typeof registerFakePlannerAdapter>

    beforeEach(() => {
        planner = registerFakePlannerAdapter({
            createMultisigProposeTransport: vi.fn(() => proposeTransport),
            createMultisigCosignTransport: vi.fn(() => cosignTransport),
        })
    })

    test('non-multisig walletconnect source returns WC transport', async () => {
        const proposeSignRequest = vi.fn()
        const selector = createTransportSelector({
            ...baseOptions(),
            proposeSignRequest,
        })
        const approve = vi.fn().mockResolvedValue(undefined)
        const transport = selector(
            {
                type: 'walletconnect',
                requestId: 'wc-1',
                callbacks: { approve },
            } as SourceMetadata,
            algo25Account,
        )

        const result = await transport.send(stubResult, {
            type: 'walletconnect',
            requestId: 'wc-1',
            callbacks: { approve },
        })

        // WC transport route — propose is NOT invoked
        expect(proposeSignRequest).not.toHaveBeenCalled()
        expect(approve).toHaveBeenCalled()
        expect(result.type).toBe('callback-sent')
    })

    test('webview source returns WC-style transport for non-multisig', () => {
        const selector = createTransportSelector(baseOptions())
        const transport = selector(
            { type: 'webview' } as SourceMetadata,
            algo25Account,
        )
        expect(transport.send).toBeInstanceOf(Function)
    })

    test('deeplink source returns WC-style transport for non-multisig', () => {
        const selector = createTransportSelector(baseOptions())
        const transport = selector(
            { type: 'deeplink' } as SourceMetadata,
            algo25Account,
        )
        expect(transport.send).toBeInstanceOf(Function)
    })

    // A keyreg scanned from a QR has no dApp waiting on the signed bytes, so
    // it tags `transport: 'algod'` and self-submits. Defaulting it to the
    // callback transport threw "No approve callback provided" and nothing was
    // ever broadcast.
    test('deeplink source tagged transport algod submits to algod', async () => {
        const sendRawTransaction = vi.fn(() => ({
            do: async () => ({ txid: 'KEYREG-TXID' }),
        }))
        registerFakeBroadcaster({
            createSubmitTransport: () =>
                algodBackedTransport(
                    { client: { algod: { sendRawTransaction } } },
                    () => [new Uint8Array([0xa1])],
                ),
        })
        const selector = createTransportSelector(baseOptions())
        const source = {
            type: 'deeplink',
            transport: 'algod',
            requestId: 'dl-1',
        } as SourceMetadata

        const result = await selector(source, algo25Account).send(
            stubResult,
            source,
        )

        expect(sendRawTransaction).toHaveBeenCalled()
        expect(result).toEqual({ type: 'submitted', txIds: ['KEYREG-TXID'] })
    })

    test('multisig-cosign throws when addSignatures not provided', () => {
        const selector = createTransportSelector(baseOptions())
        expect(() =>
            selector(
                { type: 'multisig-cosign' } as SourceMetadata,
                algo25Account,
            ),
        ).toThrow('addSignatures')
    })

    test('multisig-cosign uses the planner cosign transport when addSignatures provided', () => {
        const addSignatures = vi.fn()
        const selector = createTransportSelector({
            ...baseOptions(),
            addSignatures,
        })
        const transport = selector(
            { type: 'multisig-cosign' } as SourceMetadata,
            algo25Account,
        )
        expect(transport).toBe(cosignTransport)
        expect(planner.createMultisigCosignTransport).toHaveBeenCalledWith(
            addSignatures,
            'testnet',
        )
    })

    test('multisig account + local source throws without proposeSignRequest', () => {
        const { proposeSignRequest: _, ...rest } = {
            ...baseOptions(),
            proposeSignRequest: undefined,
        }
        const selector = createTransportSelector(rest)
        expect(() =>
            selector({ type: 'local' } as SourceMetadata, multisigAccount),
        ).toThrow('proposeSignRequest')
    })

    test('multisig account + local source uses the planner propose transport when configured', () => {
        const proposeSignRequest = vi.fn()
        const createDraftSignRequest = vi.fn()
        const options = {
            ...baseOptions(),
            proposeSignRequest,
            createDraftSignRequest,
        }
        const selector = createTransportSelector(options)
        const transport = selector(
            { type: 'local' } as SourceMetadata,
            multisigAccount,
        )
        expect(transport).toBe(proposeTransport)
        expect(planner.createMultisigProposeTransport).toHaveBeenCalledWith(
            proposeSignRequest,
            'testnet',
            options.getMsigMetadata,
            options.getDeviceId,
            createDraftSignRequest,
        )
    })

    test.each(['walletconnect', 'webview', 'deeplink'] as const)(
        'multisig account + %s source uses the propose transport (sync handoff)',
        sourceType => {
            const selector = createTransportSelector({
                ...baseOptions(),
                proposeSignRequest: vi.fn(),
            })

            const transport = selector(
                { type: sourceType } as SourceMetadata,
                multisigAccount,
            )

            expect(transport).toBe(proposeTransport)
        },
    )

    test('multisig account + walletconnect throws without proposeSignRequest', () => {
        const { proposeSignRequest: _, ...rest } = {
            ...baseOptions(),
            proposeSignRequest: undefined,
        }
        const selector = createTransportSelector(rest)
        expect(() =>
            selector(
                { type: 'walletconnect' } as SourceMetadata,
                multisigAccount,
            ),
        ).toThrow('proposeSignRequest')
    })

    test('multisig account throws when getMsigMetadata missing', () => {
        const proposeSignRequest = vi.fn()
        const selector = createTransportSelector({
            ...baseOptions(),
            proposeSignRequest,
            getMsigMetadata: undefined,
        })
        expect(() =>
            selector(
                { type: 'walletconnect' } as SourceMetadata,
                multisigAccount,
            ),
        ).toThrow(/getMsigMetadata/)
    })

    test('multisig account throws when getDeviceId missing', () => {
        const proposeSignRequest = vi.fn()
        const selector = createTransportSelector({
            ...baseOptions(),
            proposeSignRequest,
            getDeviceId: undefined,
        })
        expect(() =>
            selector(
                { type: 'walletconnect' } as SourceMetadata,
                multisigAccount,
            ),
        ).toThrow(/getDeviceId/)
    })

    test("source.transport='callback' returns callback transport", () => {
        const selector = createTransportSelector(baseOptions())
        const transport = selector(
            { type: 'local', transport: 'callback' } as SourceMetadata,
            algo25Account,
        )
        expect(transport.send).toBeInstanceOf(Function)
    })

    test('default (local, non-multisig, no callback) returns algod transport', () => {
        const selector = createTransportSelector(baseOptions())
        const transport = selector(
            { type: 'local' } as SourceMetadata,
            algo25Account,
        )
        expect(transport.send).toBeInstanceOf(Function)
    })
})
