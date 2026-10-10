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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    ChainAdapterNotRegisteredError,
    type MessageRequest,
    type SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import { CannotSignError } from '../pipeline/errors'
import {
    arbitraryDataMessageRequest,
    authDataMessageRequest,
    buildSiwxAuthData,
    isAuthDataWirePayload,
    messageSignerChainAdapters,
    messageSignerFor,
    parseAuthDataWireRequest,
    signMessages,
    type MessageSignerChainAdapter,
} from '../message-signer'
import { registerFakeMessageSignerAdapter } from './fakeMessageSignerAdapter'

const CHAIN = 'algorand'

const siwxArgs = {
    domain: 'example.io',
    address: 'ADDR',
    uri: 'https://example.io',
    nonce: 'n',
}

describe('message signer wrappers', () => {
    it('delegate to the adapter registered for the given chain id', () => {
        const payload = {
            authData: {} as never,
            metadata: { scope: 1, encoding: 'base64' },
        }
        const overrides: Partial<MessageSignerChainAdapter> = {
            isAuthDataWirePayload: vi.fn(() => true),
            parseAuthDataWireRequest: vi.fn(() => payload),
            buildSiwxAuthData: vi.fn(() => payload),
        }
        registerFakeMessageSignerAdapter(overrides)

        expect(isAuthDataWirePayload(CHAIN, { a: 1 })).toBe(true)
        expect(parseAuthDataWireRequest(CHAIN, { b: 2 })).toBe(payload)
        expect(buildSiwxAuthData(CHAIN, siwxArgs)).toBe(payload)

        expect(overrides.isAuthDataWirePayload).toHaveBeenCalledWith({ a: 1 })
        expect(overrides.parseAuthDataWireRequest).toHaveBeenCalledWith({
            b: 2,
        })
        expect(overrides.buildSiwxAuthData).toHaveBeenCalledWith(siwxArgs)
    })

    it('throw ChainAdapterNotRegisteredError when nothing is registered', () => {
        messageSignerChainAdapters.reset()

        expect(() => isAuthDataWirePayload(CHAIN, {})).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => parseAuthDataWireRequest(CHAIN, {})).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => buildSiwxAuthData(CHAIN, siwxArgs)).toThrow(
            ChainAdapterNotRegisteredError,
        )
    })
})

describe('messageSignerFor', () => {
    it('returns the registered adapter', () => {
        const adapter = registerFakeMessageSignerAdapter()

        expect(messageSignerFor(CHAIN, 'ADDR')).toBe(adapter)
    })

    it('refuses with a non-retryable CannotSignError when no signer is registered', () => {
        messageSignerChainAdapters.reset()

        let thrown: unknown
        try {
            messageSignerFor(CHAIN, 'ADDR')
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBeInstanceOf(CannotSignError)
        expect((thrown as CannotSignError).metadata.retryable).toBe(false)
    })
})

describe('message request builders', () => {
    const scope = { chainId: CHAIN, networkId: 'mainnet' }

    it('build an arbitrary-data request around one item', () => {
        expect(arbitraryDataMessageRequest(scope, 'ADDR', 'aGk=')).toEqual({
            scope,
            method: 'arbitrary-data',
            signer: 'ADDR',
            payload: { data: 'aGk=' },
        })
    })

    it('build an auth-data request that carries the payload as given', () => {
        const payload = {
            authData: {} as never,
            metadata: { scope: 1, encoding: 'base64' },
        }

        expect(authDataMessageRequest(scope, 'ADDR', payload)).toEqual({
            scope,
            method: 'auth-data',
            signer: 'ADDR',
            payload,
        })
    })
})

describe('signMessages', () => {
    const scope = { chainId: CHAIN, networkId: 'mainnet' }
    const account = {
        address: 'ADDR',
        keyPairId: 'key-1',
        custody: { kind: 'local', seed: null },
    } as unknown as WalletAccount
    const context = { account, accounts: [account] }

    const request = (data: string): MessageRequest =>
        arbitraryDataMessageRequest(scope, account.address, data)
    const planOf = (
        request: MessageRequest,
        signer = account.address,
    ): SigningRequest[] => [
        {
            requestIndex: 0,
            signer,
            scheme: 'ed25519',
            payload: new TextEncoder().encode(
                (request.payload as { data: string }).data,
            ),
        },
    ]
    const arrange = (overrides: Partial<MessageSignerChainAdapter> = {}) =>
        registerFakeMessageSignerAdapter({
            plan: vi.fn(message => planOf(message)),
            assemble: vi.fn((message, signatures) => ({
                scope: message.scope,
                signature: signatures[0],
            })),
            ...overrides,
        })
    const signPayloads = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        signPayloads.mockImplementation(async (_key, payloads: Uint8Array[]) =>
            payloads.map(payload => payload.slice().reverse()),
        )
    })

    it('signs every payload in one call under the account key, assembling per request', async () => {
        const adapter = arrange()

        const signed = await signMessages(
            [request('a'), request('bc')],
            context,
            { signPayloads },
        )

        expect(signPayloads).toHaveBeenCalledTimes(1)
        expect(signPayloads).toHaveBeenCalledWith('key-1', [
            new TextEncoder().encode('a'),
            new TextEncoder().encode('bc'),
        ])
        expect(adapter.assemble).toHaveBeenCalledTimes(2)
        expect(signed.map(message => message.signature)).toEqual([
            {
                requestIndex: 0,
                signer: 'ADDR',
                scheme: 'ed25519',
                bytes: new TextEncoder().encode('a'),
            },
            {
                requestIndex: 0,
                signer: 'ADDR',
                scheme: 'ed25519',
                bytes: new TextEncoder().encode('cb'),
            },
        ])
    })

    it('hands the planner the context it was given', async () => {
        const adapter = arrange()

        await signMessages([request('a')], context, { signPayloads })

        expect(adapter.plan).toHaveBeenCalledWith(request('a'), context)
    })

    it('never touches the key store when a later plan throws, and propagates its error', async () => {
        const failure = new Error('refused')
        arrange({
            plan: vi
                .fn()
                .mockImplementationOnce(message => planOf(message))
                .mockImplementationOnce(() => {
                    throw failure
                }),
        })

        await expect(
            signMessages([request('a'), request('b')], context, {
                signPayloads,
            }),
        ).rejects.toBe(failure)
        expect(signPayloads).not.toHaveBeenCalled()
    })

    it('refuses a method the adapter does not support, without planning', async () => {
        const adapter = arrange({ supports: vi.fn(() => false) })

        await expect(
            signMessages([request('a')], context, { signPayloads }),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(adapter.plan).not.toHaveBeenCalled()
        expect(signPayloads).not.toHaveBeenCalled()
    })

    it('refuses a plan that names a signer other than the account', async () => {
        arrange({ plan: vi.fn(message => planOf(message, 'REKEY_TARGET')) })

        await expect(
            signMessages([request('a')], context, { signPayloads }),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(signPayloads).not.toHaveBeenCalled()
    })

    it('refuses an account with no key pair', async () => {
        arrange()
        const keyless = { ...account, keyPairId: undefined }

        await expect(
            signMessages(
                [request('a')],
                { account: keyless, accounts: [keyless] },
                { signPayloads },
            ),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(signPayloads).not.toHaveBeenCalled()
    })

    it('refuses with no signer registered for the chain', async () => {
        messageSignerChainAdapters.reset()

        await expect(
            signMessages([request('a')], context, { signPayloads }),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(signPayloads).not.toHaveBeenCalled()
    })

    it('resolves an empty list without touching the key store', async () => {
        arrange()

        await expect(
            signMessages([], context, { signPayloads }),
        ).resolves.toEqual([])
        expect(signPayloads).not.toHaveBeenCalled()
    })

    it('rejects a key store that answers with the wrong number of signatures', async () => {
        arrange()
        signPayloads.mockResolvedValue([])

        await expect(
            signMessages([request('a')], context, { signPayloads }),
        ).rejects.toThrow(/wrong number of signatures/)
    })
})
