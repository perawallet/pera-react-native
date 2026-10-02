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

import { describe, expect, it, vi } from 'vitest'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { CannotSignError } from '../pipeline/errors'
import {
    buildSiwxAuthData,
    isAuthDataWirePayload,
    messageSignerChainAdapters,
    messageSignerFor,
    parseAuthDataWireRequest,
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
