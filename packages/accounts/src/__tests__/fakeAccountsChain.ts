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
import {
    addressCodecs,
    keyDerivations,
    type AddressCodec,
    type ChainId,
    type KeyDerivation,
} from '@perawallet/wallet-core-chain-contract'
import { hdDerivedKeyId } from '@perawallet/wallet-core-kms'
import {
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '../chain-adapter'
import { DerivationTypes } from '../models'

// Every legacy `Network` resolves to this id, so the fakes register under it.
export const FAKE_CHAIN_ID = 'algorand' as ChainId

export const MAINNET_SCOPE = { chainId: FAKE_CHAIN_ID, networkId: 'mainnet' }
export const TESTNET_SCOPE = { chainId: FAKE_CHAIN_ID, networkId: 'testnet' }

export const fakeEncode = (publicKey: Uint8Array): string =>
    Buffer.from(publicKey).toString('base64')

const BASE32_ADDRESS = /^[A-Z2-7]{58}$/

export type FakeAccountsChain = {
    adapter: AccountsChainAdapter
    codec: AddressCodec
    derivation: KeyDerivation
}

const createFakeAddressCodec = (): AddressCodec => ({
    chainId: FAKE_CHAIN_ID,
    fromPublicKey: vi.fn((publicKey: Uint8Array) => fakeEncode(publicKey)),
    isValid: vi.fn((address: string) => BASE32_ADDRESS.test(address)),
    normalize: (address: string) => address,
    areEqual: (a: string, b: string) => a === b,
    toPaymentUri: (address: string) => `fake:${address}`,
    parsePaymentUri: () => undefined,
})

const createFakeKeyDerivation = (): KeyDerivation => ({
    chainId: FAKE_CHAIN_ID,
    deriveAccount: vi.fn(async (_kms, seedRef, account, keyIndex) => {
        const publicKey = new Uint8Array([account, keyIndex, 0xfa, 0xce])
        return {
            keyPairId: hdDerivedKeyId(
                seedRef,
                account,
                keyIndex,
                DerivationTypes.Peikert,
            ),
            publicKey,
            address: fakeEncode(publicKey),
        }
    }),
    importRawKey: vi.fn(async () => ({ keyPairId: 'raw', address: 'RAW' })),
    discover: vi.fn(async () => []),
})

const createFakeAccountsAdapter = (): AccountsChainAdapter => ({
    chainId: FAKE_CHAIN_ID,
    hdDerivationType: DerivationTypes.Peikert,
    fetchAccountState: vi.fn(),
    fetchAccountInformation: vi.fn(),
    fetchAssetOptInRounds: vi.fn(async () => new Map<string, number>()),
    accountExists: vi.fn(async () => false),
    checkActivity: vi.fn(
        async (addresses: string[]) =>
            new Map(addresses.map(address => [address, false])),
    ),
    createPublicKeyGetter: vi.fn(() => async () => new Uint8Array(32)),
    assertHdPathMatches: vi.fn(),
    quantum: {
        deriveKeygenSeed: vi.fn((entropy: Uint8Array) => entropy.slice()),
        addressFromPublicKey: vi.fn((publicKey: Uint8Array) =>
            fakeEncode(publicKey),
        ),
    },
    fetchRekeyedAddresses: vi.fn(async () => []),
})

let current: FakeAccountsChain | undefined

/** Registers fresh fakes; overrides replace adapter members, e.g. `{ quantum: undefined }`. */
export const registerFakeAccountsChain = (
    overrides: Partial<AccountsChainAdapter> = {},
): FakeAccountsChain => {
    current = {
        adapter: { ...createFakeAccountsAdapter(), ...overrides },
        codec: createFakeAddressCodec(),
        derivation: createFakeKeyDerivation(),
    }
    accountsChainAdapters.reset()
    addressCodecs.reset()
    keyDerivations.reset()
    accountsChainAdapters.register(current.adapter)
    addressCodecs.register(current.codec)
    keyDerivations.register(current.derivation)
    return current
}

export const fakeAccountsChain = (): FakeAccountsChain => {
    if (!current) throw new Error('registerFakeAccountsChain has not run')
    return current
}
