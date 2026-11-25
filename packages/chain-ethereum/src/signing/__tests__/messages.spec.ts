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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    bytesToHex,
    concat,
    getTypesForEIP712Domain,
    hashTypedData,
    keccak256,
    toHex,
} from 'viem'
import type { Hex } from 'viem'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainScope,
    type MessageRequest,
    type Signature,
} from '@perawallet/wallet-core-chain-contract'
import {
    CannotSignError,
    messageSignerChainAdapters,
    signMessages,
} from '@perawallet/wallet-core-signing'
import { createEvmAddressCodec } from '../../accounts/address-codec'
import { UnknownEvmNetworkError } from '../../blockchain'
import { decodeEthereumLedgerMessage } from '../../ledger/messagePayload'
import {
    createEvmMessageSignerAdapter,
    domainChainBindingOf,
    personalSignMessageRequest,
    typedDataMessageRequest,
} from '../messages'
import {
    DAI_PERMIT_TYPED_DATA,
    EIP2612_PERMIT_TYPED_DATA,
    ERC721_PERMIT_TYPED_DATA,
    ETHEREUM_SIGNER_ACCOUNT,
    MAIL_TYPED_DATA,
    PERMIT2_ADDRESS,
    PERMIT2_SINGLE_NO_DEADLINE_TYPED_DATA,
    PERMIT2_SINGLE_TYPED_DATA,
    PERMIT2_TRANSFER_FROM_TYPED_DATA,
    PERMIT_NOW_MS,
    PERMIT_SPENDER,
    PERMIT_USDC,
    SENDER,
    SIGNER_KEY_PAIR_ID,
    VIEM_HELLO_WORLD,
    VIEM_MAIL,
    VIEM_PERA,
    vectorSignature,
} from './fixtures'
import { BASE, ETHEREUM } from '../../__tests__/evm-chains'

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

// A dApp's own `EIP712Domain`, listing only the fields its domain holds, so
// a `chainId` in the values is not hashed.
const declaringDomain = <T extends { domain: object; types: object }>(
    typedData: T,
    chainId?: unknown,
) => {
    const { chainId: _chainId, ...domain } = typedData.domain as {
        chainId?: unknown
    }
    return {
        ...typedData,
        domain: chainId === undefined ? domain : { ...domain, chainId },
        types: {
            EIP712Domain: getTypesForEIP712Domain({ domain }),
            ...typedData.types,
        },
    }
}

const PERMITS = [
    ['EIP-2612', EIP2612_PERMIT_TYPED_DATA],
    ['DAI-style', DAI_PERMIT_TYPED_DATA],
    ['ERC-721', ERC721_PERMIT_TYPED_DATA],
    ['Permit2 single', PERMIT2_SINGLE_TYPED_DATA],
] as const

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

describe('domainChainBindingOf', () => {
    const THREE_FIELDS = [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'verifyingContract', type: 'address' },
    ]
    const withTypes = (types: unknown, chainId?: unknown) => ({
        ...MAIL_TYPED_DATA,
        domain:
            chainId === undefined
                ? { name: 'x', version: '1' }
                : { ...MAIL_TYPED_DATA.domain, chainId },
        types: { EIP712Domain: types, ...MAIL_TYPED_DATA.types },
    })

    it.each([1, '1', '0x1'])(
        'binds an undeclared domain chainId given as %s',
        chainId => {
            expect(
                domainChainBindingOf({
                    ...MAIL_TYPED_DATA,
                    domain: { ...MAIL_TYPED_DATA.domain, chainId },
                }),
            ).toEqual({ kind: 'bound', chainId: 1n })
        },
    )

    it('names no chain for an undeclared domain without a chainId', () => {
        const { chainId: _chainId, ...domain } = MAIL_TYPED_DATA.domain

        expect(domainChainBindingOf({ ...MAIL_TYPED_DATA, domain })).toEqual({
            kind: 'none',
        })
    })

    it.each([[undefined], ['text'], [{ types: {} }]])(
        'names no chain for %j, which has no domain',
        input => {
            expect(domainChainBindingOf(input)).toEqual({ kind: 'none' })
        },
    )

    it.each([
        ['uint256', 1],
        ['uint64', 1],
        ['int256', 1],
    ])('binds a declared %s chainId field', (type, chainId) => {
        const declared = [...THREE_FIELDS, { name: 'chainId', type }]

        expect(domainChainBindingOf(withTypes(declared, chainId))).toEqual({
            kind: 'bound',
            chainId: 1n,
        })
    })

    it.each(['string', 'bytes32', 'address'])(
        'leaves a declared %s chainId field unsigned, as it hashes no chain',
        type => {
            const declared = [...THREE_FIELDS, { name: 'chainId', type }]

            expect(domainChainBindingOf(withTypes(declared, '1'))).toEqual({
                kind: 'unsigned',
            })
        },
    )

    it.each([
        ['a type that omits chainId', THREE_FIELDS],
        ['an empty type', []],
        ['a type that is not an array', { name: 'string' }],
        ['a null type', null],
    ])('leaves chainId unsigned under %s', (_name, declared) => {
        expect(domainChainBindingOf(withTypes(declared, 1))).toEqual({
            kind: 'unsigned',
        })
    })

    it('names no chain when the type and the domain both omit chainId', () => {
        expect(domainChainBindingOf(withTypes(THREE_FIELDS))).toEqual({
            kind: 'none',
        })
    })

    it('throws for a bound chainId that is not a chain id', () => {
        const typedData = {
            ...MAIL_TYPED_DATA,
            domain: { ...MAIL_TYPED_DATA.domain, chainId: 'abc' },
        }

        expect(() => domainChainBindingOf(typedData)).toThrow(
            'The typed-data message payload is malformed',
        )
    })

    it('does not read an unsigned chainId', () => {
        expect(domainChainBindingOf(withTypes(THREE_FIELDS, 'abc'))).toEqual({
            kind: 'unsigned',
        })
    })
})

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

    it('echoes the spelling of a chainId its declared EIP712Domain hashes as given', () => {
        const declared = [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
        ]
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            ...MAIL_TYPED_DATA,
            domain: { ...MAIL_TYPED_DATA.domain, chainId: '0x5' },
            types: { EIP712Domain: declared, ...MAIL_TYPED_DATA.types },
        })

        expect(() => adapter.plan(request, context)).toThrow(
            'The typed data is for EIP-155 chain 0x5, not mainnet',
        )
    })

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

describe('ethereumMessageSignerAdapter.plan with a chain the domain type leaves out', () => {
    const plan = (typedData: unknown) =>
        adapter.plan(
            typedDataMessageRequest(MAINNET, SENDER, typedData),
            context,
        )

    it.each([1, 5])(
        'refuses typed data naming chain %s that its EIP712Domain type omits',
        chainId => {
            expect(() =>
                plan(declaringDomain(MAIL_TYPED_DATA, chainId)),
            ).toThrow(
                "The typed data's domain chainId is not in its EIP712Domain type, so the signature binds no chain",
            )
        },
    )

    it.each(PERMITS)(
        'refuses a %s permit whose type omits chainId',
        (_name, permit) => {
            expect(() => plan(declaringDomain(permit, 1))).toThrow(
                /binds no chain/,
            )
            expect(() => plan(declaringDomain(permit))).toThrow(
                /binds no chain/,
            )
        },
    )

    it('refuses a permit that names no chain and declares none', () => {
        const { chainId: _chainId, ...domain } =
            EIP2612_PERMIT_TYPED_DATA.domain

        expect(() => plan({ ...EIP2612_PERMIT_TYPED_DATA, domain })).toThrow(
            "The permit's domain binds no chain, so its signature would be valid on every chain",
        )
    })

    it('still signs chain-less typed data that is not a permit', () => {
        const typedData = declaringDomain(MAIL_TYPED_DATA)

        const [item] = plan(typedData)

        expect(bytesToHex(item.payload)).toBe(hashTypedData(typedData as never))
    })
})

describe('ethereumMessageSignerAdapter.plan with a permit signature deadline', () => {
    // Every fixture permit's signature deadline is 30 days after PERMIT_NOW_MS.
    const SIGNATURE_DEADLINE_MS = PERMIT_NOW_MS + 30 * 86_400_000
    const request = (typedData: unknown) =>
        typedDataMessageRequest(MAINNET, SENDER, typedData)

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(PERMIT_NOW_MS)
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it.each([
        ...PERMITS,
        ['Permit2 transfer', PERMIT2_TRANSFER_FROM_TYPED_DATA] as const,
    ])('plans a %s permit before its deadline', (_name, permit) => {
        expect(adapter.plan(request(permit), context)).toHaveLength(1)
    })

    it.each([
        ...PERMITS,
        ['Permit2 transfer', PERMIT2_TRANSFER_FROM_TYPED_DATA] as const,
    ])('refuses a %s permit a minute after its deadline', (_name, permit) => {
        vi.setSystemTime(SIGNATURE_DEADLINE_MS + 60_000)

        expect(() => adapter.plan(request(permit), context)).toThrow(
            "the permit's signature deadline has passed",
        )
    })

    it('plans a permit just past its deadline, as the device clock may run ahead of the chain', () => {
        vi.setSystemTime(SIGNATURE_DEADLINE_MS + 59_999)

        expect(
            adapter.plan(request(PERMIT2_SINGLE_TYPED_DATA), context),
        ).toHaveLength(1)
    })

    it('plans a Permit2 permit whose allowance expiration passed while its signature is still valid', () => {
        const typed = structuredClone(PERMIT2_SINGLE_TYPED_DATA) as any
        typed.message.details.expiration = String(PERMIT_NOW_MS / 1000 - 1)

        expect(adapter.plan(request(typed), context)).toHaveLength(1)
    })

    it('still describes an expired permit, so the review can say why it cannot be signed', () => {
        vi.setSystemTime(SIGNATURE_DEADLINE_MS + 60_000)

        expect(
            adapter.describe(request(PERMIT2_SINGLE_TYPED_DATA)).spendApproval,
        ).toBeDefined()
    })

    it('refuses nothing that is not a permit', () => {
        vi.setSystemTime(SIGNATURE_DEADLINE_MS + 60_000)

        expect(adapter.plan(mailWithChainId(1), context)).toHaveLength(1)
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

    it('refuses a permit with a wrapped amount before building a device payload', () => {
        const typed = structuredClone(EIP2612_PERMIT_TYPED_DATA)
        const wrapped = {
            ...typed,
            message: { ...typed.message, value: ['1000000'] },
        }

        expect(() =>
            adapter.plan(
                typedDataMessageRequest(MAINNET, SENDER, wrapped),
                ledgerContext,
            ),
        ).toThrow('The typed-data message payload is malformed')
    })

    it.each([
        ['a permit', declaringDomain(EIP2612_PERMIT_TYPED_DATA, 1)],
        ['typed data', declaringDomain(MAIL_TYPED_DATA, 1)],
    ])(
        'refuses %s whose type omits chainId, with no device payload',
        (_name, typedData) => {
            const request = typedDataMessageRequest(MAINNET, SENDER, typedData)

            expect(() => adapter.plan(request, ledgerContext)).toThrow(
                /binds no chain/,
            )
        },
    )
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

    it('hashes a uint256 chainId exactly as declared', () => {
        const typedData = declared('uint256', '1')
        const [item] = adapter.plan(
            typedDataMessageRequest(MAINNET, SENDER, typedData),
            context,
        )

        expect(bytesToHex(item.payload)).toBe(hashTypedData(typedData as never))
    })

    it('refuses a string chainId, which hashes as text and binds no chain', () => {
        const request = typedDataMessageRequest(
            MAINNET,
            SENDER,
            declared('string', '1'),
        )

        expect(() => adapter.plan(request, context)).toThrow(/binds no chain/)
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

    it('names the spender of a DAI permit that revokes, which grants nothing', () => {
        const request = typed({
            ...DAI_PERMIT_TYPED_DATA,
            message: { ...DAI_PERMIT_TYPED_DATA.message, allowed: false },
        })

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

const signInText = (
    address: string,
    chainId: number,
    resources: string[] = [],
    trailing: string[] = [],
) =>
    toHex(
        [
            'opensea.io wants you to sign in with your Ethereum account:',
            address,
            '',
            'Click to sign in.',
            '',
            'URI: https://opensea.io/',
            'Version: 1',
            `Chain ID: ${chainId}`,
            'Nonce: 3fp8w2kd',
            'Issued At: 2026-11-20T10:00:00.000Z',
            ...(resources.length > 0
                ? ['Resources:', ...resources.map(uri => `- ${uri}`)]
                : []),
            ...trailing,
        ].join('\n'),
    )

const RECAP = `urn:recap:${Buffer.from(
    JSON.stringify({ att: { 'https://opensea.io/': { 'crud/update': [{}] } } }),
).toString('base64url')}`

describe('ethereumMessageSignerAdapter.describe for a sign-in message', () => {
    beforeAll(() => {
        addressCodecs.reset()
        addressCodecs.register(createEvmAddressCodec(ETHEREUM))
        addressCodecs.register(createEvmAddressCodec(BASE))
    })
    afterAll(() => addressCodecs.reset())

    it('titles it by its domain and reads its fields', () => {
        const summary = adapter.describe(personal(signInText(SENDER, 1)))

        expect(summary).toMatchObject({
            kind: 'text',
            title: {
                key: 'signing.sign_in.title',
                params: { domain: 'opensea.io' },
            },
            signIn: {
                message: {
                    domain: 'opensea.io',
                    address: SENDER,
                    chainId: '1',
                },
                messageScope: MAINNET,
                isOtherAddress: false,
                isOtherChain: false,
                grants: [],
                hasUnreadableGrants: false,
                isMalformed: false,
            },
        })
        expect(summary.preview).toContain('opensea.io wants you to sign in')
    })

    it('keeps the sign-in review and its grants when a line is appended', () => {
        const summary = adapter.describe(
            personal(signInText(SENDER, 1, [RECAP], ['Note: ignore me'])),
        )

        expect(summary.title).toEqual({
            key: 'signing.sign_in.title',
            params: { domain: 'opensea.io' },
        })
        expect(summary.signIn).toMatchObject({
            message: { domain: 'opensea.io' },
            grants: [
                { target: 'https://opensea.io/', abilities: ['crud/update'] },
            ],
            isMalformed: true,
        })
    })

    it('flags a chain it cannot read as another chain', () => {
        const text = [
            'opensea.io wants you to sign in with your Ethereum account:',
            SENDER,
            '',
            'URI: https://opensea.io/',
            'Version: 1',
            'Chain ID: base',
        ].join('\n')

        expect(adapter.describe(personal(toHex(text))).signIn).toMatchObject({
            isOtherChain: true,
            isMalformed: true,
        })
    })

    it('reads what its ReCap resources grant, alongside its other resources', () => {
        const signIn = adapter.describe(
            personal(signInText(SENDER, 1, ['ipfs://bafy', RECAP])),
        ).signIn

        expect(signIn?.message.resources).toEqual(['ipfs://bafy', RECAP])
        expect(signIn?.grants).toEqual([
            { target: 'https://opensea.io/', abilities: ['crud/update'] },
        ])
        expect(signIn?.hasUnreadableGrants).toBe(false)
    })

    it('flags a ReCap it cannot read', () => {
        const signIn = adapter.describe(
            personal(signInText(SENDER, 1, [RECAP, 'urn:recap:%%%'])),
        ).signIn

        expect(signIn?.grants).toHaveLength(1)
        expect(signIn?.hasUnreadableGrants).toBe(true)
    })

    it('flags an address other than the signer', () => {
        expect(
            adapter.describe(personal(signInText(OTHER, 1))).signIn
                ?.isOtherAddress,
        ).toBe(true)
    })

    it('flags a chain other than the network signed on, naming it', () => {
        const summary = adapter.describe(personal(signInText(SENDER, 8453)))

        expect(summary.signIn).toMatchObject({
            messageScope: { chainId: 'base', networkId: 'mainnet' },
            isOtherChain: true,
        })
    })

    it.each([
        ['an id in no chain table', 987654321],
        ['a chain this build does not register', 10],
    ])('flags %s, with no scope to name it', (_label, chainId) => {
        const signIn = adapter.describe(
            personal(signInText(SENDER, chainId)),
        ).signIn

        expect(signIn?.isOtherChain).toBe(true)
        expect(signIn).not.toHaveProperty('messageScope')
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

    it.each([
        ['a right-to-left override', 0x202e],
        ['a zero-width space', 0x200b],
    ])('shows a primaryType that hides content with %s as hex', (_, code) => {
        const disguised = `Mail${String.fromCharCode(code)}`
        const { Mail, ...types } = MAIL_TYPED_DATA.types
        const request = typedDataMessageRequest(MAINNET, SENDER, {
            ...MAIL_TYPED_DATA,
            types: { ...types, [disguised]: Mail },
            primaryType: disguised,
        })

        const summary = adapter.describe(request)

        expect(summary.kind).toBe('typed-data')
        expect(summary.preview).toBe(toHex(disguised))
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
