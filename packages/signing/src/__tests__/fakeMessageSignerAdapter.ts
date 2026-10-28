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
    type AuthDataSigner,
    type MessageSignerChainAdapter,
} from '../message-signer'

const notStubbed = (member: string) => () => {
    throw new Error(`fake message signer: ${member} is not stubbed`)
}

/** `authData: null` registers a signer with no auth-data leg; a partial one merges over the fakes. */
export type FakeMessageSignerOverrides = Partial<
    Omit<MessageSignerChainAdapter, 'authData'>
> & { authData?: Partial<AuthDataSigner> | null }

const fakeAuthDataSigner = (
    overrides: Partial<AuthDataSigner> = {},
): AuthDataSigner => ({
    validateAuthData: vi.fn(() => ({ decodedData: new Uint8Array() })),
    parseAuthDataForDisplay: vi.fn(() => ({
        type: 'error' as const,
        message: 'fake message signer',
    })),
    isAuthDataWirePayload: vi.fn(notStubbed('isAuthDataWirePayload')),
    parseAuthDataWireRequest: vi.fn(notStubbed('parseAuthDataWireRequest')),
    buildSiwxAuthData: vi.fn(notStubbed('buildSiwxAuthData')),
    ...overrides,
})

export const fakeMessageSignerAdapter = ({
    authData,
    ...overrides
}: FakeMessageSignerOverrides = {}): MessageSignerChainAdapter => ({
    chainId: LEGACY_CHAIN_ID,
    canSign: vi.fn(() => true),
    signsVerifiably: vi.fn(() => true),
    supports: vi.fn(() => true),
    describe: vi.fn(notStubbed('describe')),
    reviewedAddresses: vi.fn(() => []),
    plan: vi.fn(notStubbed('plan')),
    assemble: vi.fn(notStubbed('assemble')),
    ...(authData === null ? {} : { authData: fakeAuthDataSigner(authData) }),
    ...overrides,
})

export const registerFakeMessageSignerAdapter = (
    overrides: FakeMessageSignerOverrides = {},
): MessageSignerChainAdapter => {
    const adapter = fakeMessageSignerAdapter(overrides)
    messageSignerChainAdapters.reset()
    messageSignerChainAdapters.register(adapter)
    return adapter
}
