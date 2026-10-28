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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { bytesToHex, concat, hashTypedData, keccak256, toHex } from 'viem'
import type { Hex } from 'viem'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    MessageRequest,
    Signature,
} from '@perawallet/wallet-core-chain-contract'
import {
    CannotSignError,
    messageSignerChainAdapters,
    signMessages,
} from '@perawallet/wallet-core-signing'
import { UnknownEvmNetworkError } from '../../blockchain'
import { decodeEthereumLedgerMessage } from '../../ledger/messagePayload'
import {
    createEvmMessageSignerAdapter,
    personalSignMessageRequest,
    typedDataMessageRequest,
} from '../messages'
import {
    DAI_PERMIT_TYPED_DATA,
    EIP2612_PERMIT_TYPED_DATA,
    ETHEREUM_SIGNER_ACCOUNT,
    MAIL_TYPED_DATA,
    PERMIT2_ADDRESS,
    PERMIT2_SINGLE_NO_DEADLINE_TYPED_DATA,
    PERMIT_SPENDER,
    PERMIT_USDC,
    SENDER,
    SIGNER_KEY_PAIR_ID,
    VIEM_HELLO_WORLD,
    VIEM_MAIL,
    VIEM_PERA,
    vectorSignature,
} from './fixtures'
import { ETHEREUM } from '../../__tests__/evm-chains'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const OTHER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const context = {
    account: ETHEREUM_SIGNER_ACCOUNT,
    accounts: [ETHEREUM_SIGNER_ACCOUNT],
}
const adapter = createEvmMessageSignerAdapter(ETHEREUM)

const personal = (message: Hex, signer = SENDER, scope = MAINNET) =>
    personalSignMessageRequest(scope, signer, message)

const mailWithChainId = (chainId: unknown, scope = MAINNET) =>
    typedDataMessageRequest(scope, SENDER, {
        ...MAIL_TYPED_DATA,
        domain: { ...MAIL_TYPED_DATA.domain, chainId },
    })

const signAndAssemble = async (request: MessageRequest) => {
    const signatures = adapter
        .plan(request, context)
        .map((item): Signature => ({
            requestIndex: item.requestIndex,
            signer: item.signer,
            scheme: item.scheme,
            bytes: vectorSignature(item.payload),
        }))
    return await adapter.assemble(request, signatures)
}

describe('ethereumMessageSignerAdapter signatures', () => {
    it.each([
        ['hello world', VIEM_HELLO_WORLD],
        ['Pera', VIEM_PERA],
    ])('match viem signMessage for %s', async (text, expected) => {
        const signed = await signAndAssemble(personal(toHex(text)))

        expect(bytesToHex(signed.signature.bytes)).toBe(expected)
    })

    it('match viem signTypedData', async () => {
        const signed = await signAndAssemble(
            typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
        )

        expect(bytesToHex(signed.signature.bytes)).toBe(VIEM_MAIL)
    })

    afterEach(() => {
        messageSignerChainAdapters.reset()
    })

    it('sign a batch end to end under one key, in order', async () => {
        messageSignerChainAdapters.register(adapter)
        const signPayloads = vi.fn(
            async (_keyPairId: string, payloads: Uint8Array[]) =>
                payloads.map(vectorSignature),
        )

        const signed = await signMessages(
            [personal(toHex('hello world')), personal(toHex('Pera'))],
            context,
            { signPayloads },
        )

        expect(signPayloads).toHaveBeenCalledTimes(1)
        expect(signPayloads.mock.calls[0][0]).toBe(SIGNER_KEY_PAIR_ID)
        expect(
            signed.map(({ signature }) => bytesToHex(signature.bytes)),
        ).toEqual([VIEM_HELLO_WORLD, VIEM_PERA])
    })

    it('serialise 65 bytes with v of 27 or 28', async () => {
        const { bytes } = (
            await signAndAssemble(personal(toHex('hello world')))
        ).signature

        expect(bytes).toHaveLength(65)
        expect([27, 28]).toContain(bytes[64])
    })

    it('sign an empty message', () => {
        const [item] = adapter.plan(personal('0x'), context)

        expect(item.payload).toHaveLength(32)
    })
})

describe('ethereumMessageSignerAdapter.supports', () => {
    it.each(['personal_sign', 'eth_signTypedData_v4'])('signs %s', method => {
        expect(adapter.supports(method)).toBe(true)
    })

    it.each([
        'eth_sign',
        'eth_signTypedData',
        'eth_signTypedData_v1',
        'eth_signTypedData_v3',
        'eth_decrypt',
        'eth_getEncryptionPublicKey',
    ])('refuses %s by omission', method => {
        expect(adapter.supports(method)).toBe(false)
    })
})

describe('ethereumMessageSignerAdapter.plan', () => {
    const digestOf = (request: MessageRequest) =>
        adapter.plan(request, context)[0].payload

    it.each([5, '5', '0x5'])(
        'refuses typed data for EIP-155 chain %s on mainnet',
        chainId => {
            expect(() =>
                adapter.plan(mailWithChainId(chainId), context),
            ).toThrow('The typed data is for EIP-155 chain 5, not mainnet')
        },
    )

    it('refuses mainnet typed data on Sepolia', () => {
        expect(() =>
            adapter.plan(
                mailWithChainId(1, {
                    chainId: 'ethereum',
                    networkId: 'sepolia',
                }),
                context,
            ),
        ).toThrow('not sepolia')
    })

    it.each(['1', '0x1', 1n])(
        'reads domain chainId %s as chain 1, hashing it as the number',
        chainId => {
            expect(digestOf(mailWithChainId(chainId))).toEqual(
                digestOf(mailWithChainId(1)),
            )
        },
    )

    it('binds a string domain chainId into the signed domain', () => {
        const { chainId: _chainId, ...unbound } = MAIL_TYPED_DATA.domain
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            ...MAIL_TYPED_DATA,
            domain: unbound,
        })

        expect(digestOf(mailWithChainId('1'))).not.toEqual(digestOf(request))
    })

    it('signs typed data whose domain names no chain', () => {
        const { chainId: _chainId, ...domain } = MAIL_TYPED_DATA.domain
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            ...MAIL_TYPED_DATA,
            domain,
        })

        expect(adapter.plan(request, context)).toHaveLength(1)
    })

    it('refuses a chainId that is not a number', () => {
        expect(() => adapter.plan(mailWithChainId('abc'), context)).toThrow(
            'The typed-data message payload is malformed',
        )
    })

    it('refuses a network with no EIP-155 chain', () => {
        expect(() =>
            adapter.plan(
                mailWithChainId(1, {
                    chainId: 'ethereum',
                    networkId: 'custom',
                }),
                context,
            ),
        ).toThrow(UnknownEvmNetworkError)
    })

    it('accepts a lowercase signer, planning the stored address', () => {
        const [item] = adapter.plan(
            personal(toHex('Pera'), SENDER.toLowerCase()),
            context,
        )

        expect(item.signer).toBe(SENDER)
    })

    it('refuses a signer other than the account', () => {
        expect(() =>
            adapter.plan(personal(toHex('Pera'), OTHER), context),
        ).toThrow(CannotSignError)
    })

    it('refuses an account with no Ethereum address', () => {
        const algorandOnly = {
            ...ETHEREUM_SIGNER_ACCOUNT,
            chains: { algorand: { address: 'ALGO', keyPairId: 'k' } },
        } as WalletAccount

        expect(() =>
            adapter.plan(personal(toHex('Pera')), {
                account: algorandOnly,
                accounts: [algorandOnly],
            }),
        ).toThrow(CannotSignError)
    })

    it('refuses a personal_sign message that is not even-length hex', () => {
        expect(() => adapter.plan(personal('0x123' as Hex), context)).toThrow(
            'The personal_sign message payload is malformed',
        )
    })
})

describe('ethereumMessageSignerAdapter.plan device payload', () => {
    const ledger: WalletAccount = {
        id: 'ledger',
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'd1',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
        chains: { ethereum: { address: SENDER } },
    }
    const ledgerContext = { account: ledger, accounts: [ledger] }

    it.each([
        ['personal_sign', personal(toHex('hello world'))],
        [
            'typed data',
            typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
        ],
    ])('gives a local-key plan of %s no device payload', (_name, request) => {
        const [item] = adapter.plan(request, context)

        expect(item.devicePayload).toBeUndefined()
    })

    it('plans personal_sign with the raw message as its device payload', () => {
        const [item] = adapter.plan(
            personal(toHex('hello world')),
            ledgerContext,
        )

        expect(decodeEthereumLedgerMessage(item.devicePayload!)).toEqual({
            kind: 'personal',
            message: toHex('hello world'),
            signer: SENDER,
        })
    })

    it('plans typed data with the document, domain separator and struct hash as its device payload', () => {
        const request = typedDataMessageRequest(
            MAINNET,
            SENDER,
            MAIL_TYPED_DATA,
        )

        const [item] = adapter.plan(request, ledgerContext)
        const device = decodeEthereumLedgerMessage(item.devicePayload!)

        if (device.kind !== 'typedData') throw new Error('not typed data')
        expect(device.typedData.message).toEqual(MAIL_TYPED_DATA.message)
        expect(
            keccak256(
                concat(['0x1901', device.domainSeparator, device.structHash]),
            ),
        ).toBe(bytesToHex(item.payload))
        expect(hashTypedData(device.typedData)).toBe(bytesToHex(item.payload))
    })
})

describe('ethereumMessageSignerAdapter.plan with a declared EIP712Domain', () => {
    const declared = (chainIdType: string, chainId: unknown) => ({
        ...MAIL_TYPED_DATA,
        domain: { ...MAIL_TYPED_DATA.domain, chainId },
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: chainIdType },
                { name: 'verifyingContract', type: 'address' },
            ],
            ...MAIL_TYPED_DATA.types,
        },
    })

    it.each([
        ['uint256', '1'],
        ['string', '1'],
    ])('hashes a %s chainId exactly as declared', (chainIdType, chainId) => {
        const typedData = declared(chainIdType, chainId)
        const [item] = adapter.plan(
            typedDataMessageRequest(MAINNET, SENDER, typedData),
            context,
        )

        expect(bytesToHex(item.payload)).toBe(hashTypedData(typedData as never))
    })

    it('refuses a domain-only signature, which binds no message', () => {
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            ...MAIL_TYPED_DATA,
            primaryType: 'EIP712Domain',
        })

        expect(() => adapter.plan(request, context)).toThrow(
            'The typed-data message payload is malformed',
        )
        expect(adapter.describe(request).kind).toBe('raw')
    })
})

describe('ethereumMessageSignerAdapter.reviewedAddresses', () => {
    const typed = (typedData: unknown) =>
        typedDataMessageRequest(
            MAINNET,
            SENDER,
            typedData as Parameters<typeof typedDataMessageRequest>[2],
        )

    it('names an EIP-2612 permit’s spender, its token contract and its owner', () => {
        expect(
            adapter.reviewedAddresses(typed(EIP2612_PERMIT_TYPED_DATA)),
        ).toEqual([
            { address: PERMIT_USDC, role: 'target' },
            { address: SENDER, role: 'referenced-account' },
            { address: PERMIT_SPENDER, role: 'spender' },
        ])
    })

    it('names the spender of a DAI permit the permit parser does not recognise', () => {
        const request = typed(DAI_PERMIT_TYPED_DATA)

        expect(adapter.describe(request).spendApproval).toBeUndefined()
        expect(adapter.reviewedAddresses(request)).toContainEqual({
            address: PERMIT_SPENDER,
            role: 'spender',
        })
    })

    it('names the spender and nested token of a Permit2 message with no deadline', () => {
        const request = typed(PERMIT2_SINGLE_NO_DEADLINE_TYPED_DATA)

        expect(adapter.describe(request).spendApproval).toBeUndefined()
        expect(adapter.reviewedAddresses(request)).toEqual([
            { address: PERMIT2_ADDRESS, role: 'target' },
            { address: PERMIT_USDC, role: 'referenced-account' },
            { address: PERMIT_SPENDER, role: 'spender' },
        ])
    })

    it('names an operator, and every address in an array', () => {
        const request = typed({
            domain: { name: 'Fixture', chainId: 1 },
            types: {
                Grant: [
                    { name: 'operator', type: 'address' },
                    { name: 'recipients', type: 'address[]' },
                ],
            },
            primaryType: 'Grant',
            message: {
                operator: PERMIT_SPENDER,
                recipients: [OTHER, PERMIT_USDC],
            },
        })

        expect(adapter.reviewedAddresses(request)).toEqual([
            { address: PERMIT_SPENDER, role: 'operator' },
            { address: OTHER, role: 'referenced-account' },
            { address: PERMIT_USDC, role: 'referenced-account' },
        ])
    })

    it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
        'reads a field named %s as a referenced account',
        fieldName => {
            const request = typed({
                domain: { name: 'Fixture', chainId: 1 },
                types: { Grant: [{ name: fieldName, type: 'address' }] },
                primaryType: 'Grant',
                message: JSON.parse(
                    JSON.stringify({ [fieldName]: PERMIT_SPENDER }),
                ),
            })

            expect(adapter.reviewedAddresses(request)).toEqual([
                { address: PERMIT_SPENDER, role: 'referenced-account' },
            ])
        },
    )

    it('skips an address field holding something that is not an address', () => {
        const request = typed({
            ...DAI_PERMIT_TYPED_DATA,
            message: { ...DAI_PERMIT_TYPED_DATA.message, spender: 'nobody' },
        })

        expect(
            adapter.reviewedAddresses(request).map(({ role }) => role),
        ).not.toContain('spender')
    })

    it('names nothing for personal_sign or a payload it cannot read', () => {
        expect(
            adapter.reviewedAddresses(personal(toHex(PERMIT_SPENDER))),
        ).toEqual([])
        expect(
            adapter.reviewedAddresses({
                ...personal('0x'),
                method: 'eth_signTypedData_v4',
                payload: { typedData: 'not typed data' },
            }),
        ).toEqual([])
    })
})

describe('ethereumMessageSignerAdapter.describe', () => {
    it('shows readable text', () => {
        expect(adapter.describe(personal(toHex('Sign in to Pera')))).toEqual({
            kind: 'text',
            title: { key: 'signing.arbitrary_data_view.body' },
            preview: 'Sign in to Pera',
        })
    })

    it.each([
        ['bytes that are not UTF-8', '0xff00'],
        ['a right-to-left override', toHex('pay \u202Eevil')],
        ['an empty message', '0x'],
    ] as const)('shows %s as hex', (_label, message) => {
        expect(adapter.describe(personal(message))).toMatchObject({
            kind: 'raw',
            preview: message,
        })
    })

    it.each([
        personal('nope' as Hex),
        typedDataMessageRequest(MAINNET, SENDER, { primaryType: 'Mail' }),
    ])('describes a malformed payload without throwing', request => {
        expect(adapter.describe(request)).toEqual({
            kind: 'raw',
            title: { key: 'signing.arbitrary_data_view.body' },
        })
    })

    it('shows typed data as its signed fields, in schema order', () => {
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            ...MAIL_TYPED_DATA,
            message: { ...MAIL_TYPED_DATA.message, unsigned: 'not hashed' },
        })

        expect(adapter.describe(request)).toEqual({
            kind: 'typed-data',
            title: { key: 'signing.arbitrary_data_view.body' },
            preview: 'Mail',
            tree: [
                {
                    label: 'domain',
                    children: [
                        { label: 'name', value: 'Ether Mail' },
                        { label: 'version', value: '1' },
                        { label: 'chainId', value: '1' },
                        {
                            label: 'verifyingContract',
                            value: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
                        },
                    ],
                },
                {
                    label: 'message',
                    children: [
                        {
                            label: 'from',
                            children: [
                                { label: 'name', value: 'Cow' },
                                {
                                    label: 'wallet',
                                    value: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
                                },
                            ],
                        },
                        {
                            label: 'to',
                            children: [
                                { label: 'name', value: 'Bob' },
                                {
                                    label: 'wallet',
                                    value: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
                                },
                            ],
                        },
                        { label: 'contents', value: 'Hello, Bob!' },
                    ],
                },
            ],
        })
    })

    it('throws for a method it does not sign', () => {
        expect(() =>
            adapter.describe({
                ...personal(toHex('Pera')),
                method: 'eth_sign',
            }),
        ).toThrow('Unsupported message method eth_sign')
    })

    it('lays the domain out by a declared EIP712Domain', () => {
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            ...MAIL_TYPED_DATA,
            types: {
                EIP712Domain: [
                    { name: 'chainId', type: 'uint256' },
                    { name: 'name', type: 'string' },
                ],
                ...MAIL_TYPED_DATA.types,
            },
            domain: { chainId: 1, name: 'Ether Mail' },
        })

        expect(adapter.describe(request).tree?.[0]).toEqual({
            label: 'domain',
            children: [
                { label: 'chainId', value: '1' },
                { label: 'name', value: 'Ether Mail' },
            ],
        })
    })

    it('shows a string field that hides content as hex', () => {
        const disguised = `pay ${String.fromCharCode(0x202e)}evil`
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            ...MAIL_TYPED_DATA,
            message: { ...MAIL_TYPED_DATA.message, contents: disguised },
        })

        const message = adapter.describe(request).tree?.[1]

        expect(message).toMatchObject({
            children: expect.arrayContaining([
                { label: 'contents', value: toHex(disguised) },
            ]),
        })
    })

    it('labels array elements by index', () => {
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            domain: { name: 'Group' },
            types: {
                Group: [{ name: 'members', type: 'address[]' }],
            },
            primaryType: 'Group',
            message: { members: [SENDER, OTHER] },
        })

        expect(adapter.describe(request).tree?.[1]).toEqual({
            label: 'message',
            children: [
                {
                    label: 'members',
                    children: [
                        { label: '0', value: SENDER },
                        { label: '1', value: OTHER },
                    ],
                },
            ],
        })
    })
})

describe('ethereumMessageSignerAdapter.canSign and signsVerifiably', () => {
    const watch: WalletAccount = {
        id: 'watch',
        custody: { kind: 'watch' },
        chains: { ethereum: { address: SENDER } },
    }

    it.each(['message', 'typedData'] as const)(
        'signs %s with a local key',
        kind => {
            expect(adapter.canSign(ETHEREUM_SIGNER_ACCOUNT, kind)).toBe(true)
            expect(adapter.signsVerifiably(ETHEREUM_SIGNER_ACCOUNT, kind)).toBe(
                true,
            )
        },
    )

    it.each(['arbitraryData', 'authData'] as const)('signs no %s', kind => {
        expect(adapter.canSign(ETHEREUM_SIGNER_ACCOUNT, kind)).toBe(false)
        expect(adapter.signsVerifiably(ETHEREUM_SIGNER_ACCOUNT, kind)).toBe(
            false,
        )
    })

    it('cannot sign for a watch account', () => {
        expect(adapter.canSign(watch, 'message')).toBe(false)
    })

    const ledgerWith = (chains: WalletAccount['chains']): WalletAccount => ({
        id: 'ledger',
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'd1',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
        chains,
    })

    it.each(['message', 'typedData'] as const)(
        'lets a Ledger account with an Ethereum address sign %s',
        kind => {
            const ledger = ledgerWith({ ethereum: { address: SENDER } })

            expect(adapter.canSign(ledger, kind)).toBe(true)
        },
    )

    it('refuses a Ledger account with no Ethereum address', () => {
        const ledger = ledgerWith({ algorand: { address: 'ALGO' } })

        expect(adapter.canSign(ledger, 'message')).toBe(false)
    })

    it('has no auth-data leg', () => {
        expect(adapter.authData).toBeUndefined()
    })
})

describe('ethereumMessageSignerAdapter.assemble', () => {
    const request = personal(toHex('hello world'))
    const [planned] = adapter.plan(request, context)
    const signature: Signature = {
        requestIndex: 0,
        signer: planned.signer,
        scheme: 'secp256k1',
        bytes: vectorSignature(planned.payload),
    }

    it('refuses a 64-byte signature', async () => {
        await expect(async () =>
            adapter.assemble(request, [
                { ...signature, bytes: signature.bytes.slice(0, 64) },
            ]),
        ).rejects.toThrow()
    })

    it('refuses a signature for another request index', async () => {
        await expect(async () =>
            adapter.assemble(request, [{ ...signature, requestIndex: 1 }]),
        ).rejects.toThrow('exactly one secp256k1 signature')
    })

    // The signer's key over another message recovers to some other address:
    // the label alone would pass it off as a signature over this one.
    it.each([
        ['personal_sign', personal(toHex('Pera'))],
        ['EIP-712', typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA)],
    ])(
        "refuses a %s signature that doesn't recover to the signer",
        async (_method, other) => {
            await expect(async () =>
                adapter.assemble(other, [signature]),
            ).rejects.toThrow(
                /^The signature recovers to 0x[0-9a-fA-F]{40}, not the signer /,
            )
        },
    )
})
