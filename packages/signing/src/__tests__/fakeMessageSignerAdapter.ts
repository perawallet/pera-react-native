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

import { vi } from 'vitest'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    messageSignerChainAdapters,
    type MessageSignerChainAdapter,
} from '../message-signer'

const notStubbed = (member: string) => () => {
    throw new Error(`fake message signer: ${member} is not stubbed`)
}

export const fakeMessageSignerAdapter = (
    overrides: Partial<MessageSignerChainAdapter> = {},
): MessageSignerChainAdapter => ({
    chainId: LEGACY_CHAIN_ID,
    signArbitraryData: vi.fn(notStubbed('signArbitraryData')),
    signAuthData: vi.fn(notStubbed('signAuthData')),
    validateAuthData: vi.fn(() => ({ decodedData: new Uint8Array() })),
    parseAuthDataForDisplay: vi.fn(() => ({
        type: 'error' as const,
        message: 'fake message signer',
    })),
    isAuthDataWirePayload: vi.fn(notStubbed('isAuthDataWirePayload')),
    parseAuthDataWireRequest: vi.fn(notStubbed('parseAuthDataWireRequest')),
    buildSiwxAuthData: vi.fn(notStubbed('buildSiwxAuthData')),
    signerPublicKey: vi.fn(() => new Uint8Array(32)),
    ...overrides,
})

export const registerFakeMessageSignerAdapter = (
    overrides: Partial<MessageSignerChainAdapter> = {},
): MessageSignerChainAdapter => {
    const adapter = fakeMessageSignerAdapter(overrides)
    messageSignerChainAdapters.reset()
    messageSignerChainAdapters.register(adapter)
    return adapter
}
