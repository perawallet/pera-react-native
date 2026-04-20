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

import { describe, test, expect, vi } from 'vitest'
import { createTransportSelector } from '../getTransport'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { SourceMetadata } from '../../types'

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

const baseOptions = () => ({
    algokit: {
        client: { algod: { sendRawTransaction: vi.fn() } },
    },
    encodeSignedTransactions: vi.fn(),
})

describe('createTransportSelector', () => {
    test('walletconnect source returns WC transport regardless of account', () => {
        const selector = createTransportSelector(baseOptions())
        const transport = selector(
            { type: 'walletconnect' } as SourceMetadata,
            algo25Account,
        )
        expect(transport.send).toBeInstanceOf(Function)
    })

    test('webview source returns WC-style transport', () => {
        const selector = createTransportSelector(baseOptions())
        const transport = selector(
            { type: 'webview' } as SourceMetadata,
            algo25Account,
        )
        expect(transport.send).toBeInstanceOf(Function)
    })

    test('deeplink source returns WC-style transport', () => {
        const selector = createTransportSelector(baseOptions())
        const transport = selector(
            { type: 'deeplink' } as SourceMetadata,
            algo25Account,
        )
        expect(transport.send).toBeInstanceOf(Function)
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

    test('multisig-cosign uses cosign transport when addSignatures provided', () => {
        const addSignatures = vi.fn()
        const selector = createTransportSelector({
            ...baseOptions(),
            addSignatures,
        })
        const transport = selector(
            { type: 'multisig-cosign' } as SourceMetadata,
            algo25Account,
        )
        expect(transport.send).toBeInstanceOf(Function)
    })

    test('multisig account + local source throws without proposeSignRequest', () => {
        const selector = createTransportSelector(baseOptions())
        expect(() =>
            selector({ type: 'local' } as SourceMetadata, multisigAccount),
        ).toThrow('proposeSignRequest')
    })

    test('multisig account + local source uses propose transport when configured', () => {
        const proposeSignRequest = vi.fn()
        const selector = createTransportSelector({
            ...baseOptions(),
            proposeSignRequest,
        })
        const transport = selector(
            { type: 'local' } as SourceMetadata,
            multisigAccount,
        )
        expect(transport.send).toBeInstanceOf(Function)
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
