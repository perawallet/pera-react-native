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
import { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    accountsChainAdapters,
    type AccountStateSnapshot,
    type AccountsChainAdapter,
    type DecodedAccountRecord,
    type LocalKeyKind,
} from '../chain-adapter'
import { authorityOf } from '../credentials/accessors'
import {
    accountPresentationChainAdapters,
    type AccountKindPresentation,
    type AccountPresentationChainAdapter,
} from '../presentation-adapter'
import type { AccountCustody, WalletAccount } from '../models'
import { useAccountChainStateStore } from '../store/accountChainState'
import { canSignDirectly } from '../utils'

// Every legacy `Network` resolves to this id, so the fakes register under it.
// Everything else about the fake (key kinds, copy, wire values) is its own.
export const FAKE_CHAIN_ID = 'algorand' as ChainId

export const MAINNET_SCOPE = { chainId: FAKE_CHAIN_ID, networkId: 'mainnet' }
export const TESTNET_SCOPE = { chainId: FAKE_CHAIN_ID, networkId: 'testnet' }

export const fakeEncode = (publicKey: Uint8Array): string =>
    btoa(String.fromCharCode(...publicKey))

const fakeHdKeyPairId: AccountsChainAdapter['hdKeyPairId'] = (
    seedKeyId,
    { account, keyIndex },
) => `${seedKeyId}-acc${account}-idx${keyIndex}-dt9`

const BASE32_ADDRESS = /^[A-Z2-7]{58}$/

/** The fake's key kinds: an HD kind on 12 or 24 words, and the standalone and a seeded single-key kind sharing 25 words, only the first auto-detected. */
export const FAKE_HD_SEED = SeedScheme.Bip39
export const FAKE_SINGLE_SEED = null
export const FAKE_EXPLICIT_SEED = SeedScheme.Quantum

export const FAKE_LOCAL_KEY_KINDS: readonly LocalKeyKind[] = [
    {
        seed: FAKE_HD_SEED,
        signingScheme: 'ed25519',
        isHd: true,
        mnemonicWordCounts: [12, 24],
        isAutoDetected: true,
    },
    {
        seed: FAKE_SINGLE_SEED,
        signingScheme: 'ed25519',
        isHd: false,
        mnemonicWordCounts: [25],
        isAutoDetected: true,
    },
    {
        seed: FAKE_EXPLICIT_SEED,
        signingScheme: 'falcon-1024',
        isHd: false,
        mnemonicWordCounts: [25],
        isAutoDetected: false,
    },
]

/** Hardware outranks local, local outranks multisig, watch ranks lowest. */
export const FAKE_DUPLICATE_RANK: Record<AccountCustody['kind'], number> = {
    hardware: 40,
    local: 30,
    multisig: 20,
    watch: 10,
}

/** `local-<seed>` for local custody, the custody kind otherwise. */
export const fakeKindOf = (account: WalletAccount): string =>
    account.custody.kind === 'local'
        ? `local-${account.custody.seed}`
        : account.custody.kind

/** The fake's kind id: `fake.<fakeKindOf>`. */
export const fakeKindIdOf = (account: WalletAccount): string =>
    `fake.${fakeKindOf(account)}`

const fakePresentationOfKind = (kindId: string): AccountKindPresentation => ({
    labelKey: `${kindId}.label`,
    infoTitleKey: `${kindId}.info_title`,
    infoBodyKey: `${kindId}.info_body`,
    glyph: `fake-glyph-${kindId.slice('fake.'.length)}`,
})

export const fakePresentationOf = (
    account: WalletAccount,
): AccountKindPresentation => fakePresentationOfKind(fakeKindIdOf(account))

const isCustody = (value: unknown): value is AccountCustody =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { kind?: unknown }).kind === 'string'

/**
 * The fake's legacy record: a top-level `address`, with a `keyPairId` marking
 * a local key unless a `custody` says otherwise. Anything without an address
 * isn't the fake's.
 */
export const decodeFakeLegacyRecord = (
    raw: unknown,
): DecodedAccountRecord | undefined => {
    if (typeof raw !== 'object' || raw === null) return undefined
    const record = raw as Record<string, unknown>
    if (typeof record.address !== 'string') return undefined
    const keyPairId =
        typeof record.keyPairId === 'string' ? record.keyPairId : undefined
    const custody: AccountCustody = isCustody(record.custody)
        ? record.custody
        : keyPairId
          ? { kind: 'local', seed: FAKE_SINGLE_SEED }
          : { kind: 'watch' }
    return {
        custody,
        chains: {
            [FAKE_CHAIN_ID]: {
                address: record.address,
                ...(custody.kind === 'local' && keyPairId ? { keyPairId } : {}),
            },
        },
    }
}

/** A state read with a native balance of `nativeBaseUnits` and nothing else. */
export const fakeAccountStateSnapshot = (
    nativeBaseUnits = 0,
    overrides: Partial<AccountStateSnapshot> = {},
): AccountStateSnapshot => ({
    nativeBalance: new Decimal(nativeBaseUnits).div(100),
    nativeBalanceBaseUnits: new Decimal(nativeBaseUnits),
    minBalance: new Decimal(0),
    authorityAddress: null,
    chainState: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    holdings: [
        {
            assetId: 'fake-native',
            amount: new Decimal(nativeBaseUnits),
            isFrozen: false,
        },
    ],
    observedRound: null,
    ...overrides,
})

export type FakeAccountsChain = {
    adapter: AccountsChainAdapter
    presentation: AccountPresentationChainAdapter
    codec: AddressCodec
    derivation: KeyDerivation
}

const createFakeAddressCodec = (): AddressCodec => ({
    chainId: FAKE_CHAIN_ID,
    fromPublicKey: vi.fn((publicKey: Uint8Array) => fakeEncode(publicKey)),
    isValid: vi.fn((address: string) => BASE32_ADDRESS.test(address)),
    normalize: (address: string) => address,
    areEqual: (a: string, b: string) => a === b,
    truncate: (address: string) =>
        address.length > 8
            ? `${address.slice(0, 3)}~${address.slice(-3)}`
            : address,
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
        ...(observed.authorityAddress
            ? { authAddress: observed.authorityAddress }
            : {}),
    })),
    fetchAssetOptInRounds: vi.fn(async () => new Map<string, number>()),
    accountExists: vi.fn(async () => false),
    checkActivity: vi.fn(
        async (addresses: string[]) =>
            new Map(addresses.map(address => [address, false])),
    ),
    createPublicKeyGetter: vi.fn(() => async () => new Uint8Array(32)),
    hdKeyPairId: vi.fn(fakeHdKeyPairId),
    assertHdPathMatches: vi.fn(),
    localKeyKinds: FAKE_LOCAL_KEY_KINDS,
    duplicateRank: vi.fn(
        (account: WalletAccount) => FAKE_DUPLICATE_RANK[account.custody.kind],
    ),
    kindIdOf: vi.fn(fakeKindIdOf),
    decodeLegacyRecord: vi.fn(decodeFakeLegacyRecord),
    multisigNative: {
        parametersOf: vi.fn(native =>
            native?.multisig
                ? {
                      ...native.multisig,
                      addresses: [...native.multisig.addresses],
                  }
                : undefined,
        ),
        withParameters: vi.fn((native, { version, threshold, addresses }) => ({
            ...native,
            family: 'algorand' as const,
            multisig: { version, threshold, addresses: [...addresses] },
        })),
    },
    singleKeyAccounts: {
        create: vi.fn(),
        importMnemonic: vi.fn(),
        findAlternateImportKinds: vi.fn(async () => []),
    },
    fetchRekeyedAddresses: vi.fn(async () => []),
    resolveSigner: vi.fn((account, _accounts, _scope) =>
        canSignDirectly(account)
            ? { kind: 'ok' as const, signer: account }
            : { kind: 'watch' as const, account },
    ),
    getAuthAccount: vi.fn(account => account),
    authority: {
        targetKinds: [
            { id: 'fake-target-local', category: 'standard' },
            { id: 'fake-target-hardware', category: 'hardware' },
        ],
        isDelegated: vi.fn((account, scope) => !!authorityOf(account, scope)),
        accountsDelegatedTo: vi.fn(() => []),
        isEligibleTarget: vi.fn(() => false),
        canSignProgram: vi.fn(() => false),
        isAuthorityDowngrade: vi.fn(() => false),
    },
})

const createFakePresentation = (): AccountPresentationChainAdapter => ({
    chainId: FAKE_CHAIN_ID,
    describe: vi.fn((kindId: string) =>
        kindId.startsWith('fake.') ? fakePresentationOfKind(kindId) : undefined,
    ),
    transitionLabel: vi.fn((from: string, to: string) => ({
        labelKey: 'fake.transition.label',
        signerKey: `${to}.signer`,
        descriptionKey: `fake.transition.${from.slice('fake.'.length)}_to_${to.slice('fake.'.length)}`,
    })),
})

let current: FakeAccountsChain | undefined

/** Registers fresh fakes; overrides replace adapter members, e.g. `{ authority: undefined }`. */
export const registerFakeAccountsChain = (
    overrides: Partial<AccountsChainAdapter> = {},
): FakeAccountsChain => {
    current = {
        adapter: { ...createFakeAccountsAdapter(), ...overrides },
        presentation: createFakePresentation(),
        codec: createFakeAddressCodec(),
        derivation: createFakeKeyDerivation(),
    }
    accountsChainAdapters.reset()
    accountPresentationChainAdapters.reset()
    addressCodecs.reset()
    keyDerivations.reset()
    accountsChainAdapters.register(current.adapter)
    accountPresentationChainAdapters.register(current.presentation)
    addressCodecs.register(current.codec)
    keyDerivations.register(current.derivation)
    return current
}

export const fakeAccountsChain = (): FakeAccountsChain => {
    if (!current) throw new Error('registerFakeAccountsChain has not run')
    return current
}

/** Records `authorityAddress` as `address`'s authority on `scope`; `null` is an observed "signs for itself". */
export const seedAuthority = (
    address: string,
    authorityAddress: string | null,
    scope: ChainScope = MAINNET_SCOPE,
): void =>
    useAccountChainStateStore
        .getState()
        .setAccountChainState(
            scope,
            address,
            fakeAccountsChain().adapter.toChainState({ authorityAddress }),
        )
