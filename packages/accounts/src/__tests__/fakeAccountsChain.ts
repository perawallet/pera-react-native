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
import { Decimal } from 'decimal.js'
import {
    addressCodecs,
    keyDerivations,
    type AddressCodec,
    type ChainId,
    type ChainScope,
    type KeyDerivation,
} from '@perawallet/wallet-core-chain-contract'
import {
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '../chain-adapter'
import { authorityOf } from '../credentials/accessors'
import { AccountError } from '../errors'
import { DerivationTypes } from '../models'
import { useAccountChainStateStore } from '../store/accountChainState'
import { canSignDirectly } from '../utils'

// Every legacy `Network` resolves to this id, so the fakes register under it.
export const FAKE_CHAIN_ID = 'algorand' as ChainId

export const MAINNET_SCOPE = { chainId: FAKE_CHAIN_ID, networkId: 'mainnet' }
export const TESTNET_SCOPE = { chainId: FAKE_CHAIN_ID, networkId: 'testnet' }

export const fakeEncode = (publicKey: Uint8Array): string =>
    Buffer.from(publicKey).toString('base64')

const fakeHdKeyPairId: AccountsChainAdapter['hdKeyPairId'] = (
    seedKeyId,
    { account, keyIndex },
) => `${seedKeyId}-acc${account}-idx${keyIndex}-dt9`

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
            keyPairId: fakeHdKeyPairId(seedRef, { account, keyIndex }),
            publicKey,
            address: fakeEncode(publicKey),
        }
    }),
    importRawKey: vi.fn(async () => ({ keyPairId: 'raw', address: 'RAW' })),
    discover: vi.fn(async () => []),
})

const createFakeAccountsAdapter = (): AccountsChainAdapter => ({
    chainId: FAKE_CHAIN_ID,
    fetchAccountState: vi.fn(),
    toChainState: vi.fn(observed => ({
        family: 'algorand' as const,
        minBalance: observed.minBalance ?? new Decimal(0),
        status: 'Offline' as const,
        totalAssetsOptedIn: 0,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
        ...(observed.authAddress ? { authAddress: observed.authAddress } : {}),
    })),
    toAccountInformationAddress: vi.fn(
        ((address: string) =>
            address) as unknown as AccountsChainAdapter['toAccountInformationAddress'],
    ),
    fetchAccountInformation: vi.fn(),
    fetchAssetOptInRounds: vi.fn(async () => new Map<string, number>()),
    accountExists: vi.fn(async () => false),
    checkActivity: vi.fn(
        async (addresses: string[]) =>
            new Map(addresses.map(address => [address, false])),
    ),
    createPublicKeyGetter: vi.fn(() => async () => new Uint8Array(32)),
    hdKeyPairId: vi.fn(fakeHdKeyPairId),
    assertHdPathMatches: vi.fn(),
    legacyDetails: (custody, entry) => {
        if (custody.kind === 'local' && custody.seed === 'bip39') {
            return {
                hdWalletDetails: {
                    ...custody.hd,
                    change: 0,
                    derivationType: DerivationTypes.Peikert,
                },
            }
        }
        if (custody.kind === 'multisig') {
            const multisig = entry.native?.multisig
            if (!multisig) throw new AccountError('multisig missing')
            return { multisigDetails: { ...multisig } }
        }
        return {}
    },
    quantum: {
        deriveKeygenSeed: vi.fn((entropy: Uint8Array) => entropy.slice()),
        addressFromPublicKey: vi.fn((publicKey: Uint8Array) =>
            fakeEncode(publicKey),
        ),
    },
    singleKeyAccounts: {
        create: vi.fn(),
        importMnemonic: vi.fn(),
        findQuantumAccountForAlgo25Mnemonic: vi.fn(),
    },
    fetchRekeyedAddresses: vi.fn(async () => []),
    resolveSigner: vi.fn((account, _accounts, _scope) =>
        canSignDirectly(account)
            ? { kind: 'ok' as const, signer: account }
            : { kind: 'watch' as const, account },
    ),
    getAuthAccount: vi.fn(account => account),
    authority: {
        isDelegated: vi.fn((account, scope) => !!authorityOf(account, scope)),
        accountsDelegatedTo: vi.fn(() => []),
        isEligibleTarget: vi.fn(() => false),
        canSignProgram: vi.fn(() => false),
    },
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

/**
 * Records `authAddress` as `address`'s authority on `scope`; `null` is an
 * observed "signs for itself", which shadows the legacy record fields.
 */
export const seedAuthority = (
    address: string,
    authAddress: string | null,
    scope: ChainScope = MAINNET_SCOPE,
): void =>
    useAccountChainStateStore
        .getState()
        .setAccountChainState(
            scope,
            address,
            fakeAccountsChain().adapter.toChainState({ authAddress }),
        )
