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

import type { Decimal } from 'decimal.js'
import {
    createChainAdapterRegistry,
    keyDerivations,
    type ChainId,
    type ChainScope,
    type DeriveOpts,
    type AccountChainState,
    type SigningScheme,
} from '@perawallet/wallet-core-chain-contract'
import { kmsCore, type useKMS } from '@perawallet/wallet-core-kms'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    HdAccountsUnsupportedError,
    RekeyUnsupportedError,
    SingleKeyAccountsUnsupportedError,
} from './errors'
import type {
    AccountChains,
    AccountCustody,
    HdIndex,
    LocalCustody,
    WalletAccount,
} from './models'
import type { SignerResolution } from './signer-resolution'

/** A kind of authority target the chain lists, such as the account kinds a rekey may move to. */
export type AuthorityTargetKind = string

/** Switches the chain reads when deciding a target, e.g. a feature only some networks support. */
export type AuthorityTargetOptions = Readonly<Record<string, boolean>>

/** Moving an account's signing authority to another account. */
export type AccountAuthorityOps = {
    /** Every kind `isEligibleTarget` answers for. */
    readonly targetKinds: readonly AuthorityTargetKind[]
    isDelegated(account: WalletAccount, scope: ChainScope): boolean
    /** Held accounts whose authority is `address` on any of the chain's scopes; never `address` itself. */
    accountsDelegatedTo(
        address: string,
        accounts: WalletAccount[],
    ): WalletAccount[]
    isEligibleTarget(
        kind: AuthorityTargetKind,
        target: WalletAccount,
        source: WalletAccount,
        accounts: WalletAccount[],
        scope: ChainScope,
        options: AuthorityTargetOptions,
    ): boolean
    /** Whether the account can produce a usable delegated program signature. */
    canSignProgram(account: WalletAccount, scope: ChainScope): boolean
    /**
     * Whether moving `source`'s authority to `target` gives up a protection
     * the current authority has, so the user is warned first.
     */
    isAuthorityDowngrade(
        source: WalletAccount,
        target: WalletAccount,
        accounts: WalletAccount[],
        scope: ChainScope,
    ): boolean
}

/** The `custody.seed` a local key kind is stored under; `null` is the chain's standalone kind. */
export type LocalKeySeed = LocalCustody['seed']

/** A software key kind a chain mints. */
export type LocalKeyKind = {
    seed: LocalKeySeed
    signingScheme: SigningScheme
    isHd: boolean
    mnemonicWordCounts: readonly number[]
    /** False: reachable only from its own import entry, never from a word count. */
    isAutoDetected: boolean
}

/** How an account of the chain is shown. Keys are i18n keys; glyphs are ids the app maps to icons. */
export type AccountKindPresentation = {
    /** Stable for the account's kind, whatever its authority. */
    kindId: string
    labelKey: string
    infoTitleKey: string
    infoBodyKey: string
    glyph: string
    /** The glyph an account delegated to this kind shows; absent uses the generic one. */
    rekeyedGlyph?: string
    supportUrl?: string
    analyticsKind: string
}

/** The copy for an account whose authority moved from `from`'s kind to `to`'s. */
export type AuthorityTransitionLabel = {
    /** Interpolates the signer copy as `to`. */
    labelKey: string
    signerKey: string
    descriptionKey: string
    supportUrl?: string
}

export type AccountPresentationOps = {
    /**
     * `accounts` and `scope` let a kind's copy depend on whether it can sign
     * there, as a multisig's does.
     */
    describe(
        account: WalletAccount,
        accounts: readonly WalletAccount[],
        scope: ChainScope,
    ): AccountKindPresentation
    /**
     * The glyph `describe` gives a kind, for a kind shown without an account
     * (an address held only in a backup); undefined for an id the chain
     * doesn't describe.
     */
    kindGlyph(kindId: string): string | undefined
    transitionLabel(
        from: WalletAccount,
        to: WalletAccount,
    ): AuthorityTransitionLabel
}

export type DecodedAccountRecord = {
    custody: AccountCustody
    chains: AccountChains
}

export type AccountHoldingSnapshot = {
    assetId: string
    /** Base units. */
    amount: Decimal
    isFrozen: boolean
}

/** One read of an account's balance, holdings and signer, as the syncer persists it. */
export type AccountStateSnapshot = {
    /** Display units of the chain's native asset. */
    nativeBalance: Decimal
    /** Base units of the chain's native asset. */
    nativeBalanceBaseUnits: Decimal
    /** Persisted to `account_chain_state`; amounts inside are in base units. */
    chainState: AccountChainState
    /** Display units of the chain's native asset; zero on a chain with no reserve. */
    minBalance: Decimal
    // Algorand's resource counts and participation status. A chain without
    // the concept omits them and the balance row keeps its column defaults.
    totalAssetsOptedIn?: number
    totalCreatedAssets?: number
    totalAppsOptedIn?: number
    status?: string
    /** The account's signer when it isn't the account's own key. */
    authorityAddress: Nullable<string>
    /** Includes the native asset, so reads sort and page it like any holding. */
    holdings: AccountHoldingSnapshot[]
    /**
     * The minimum round across every source read, so the sync checkpoint only
     * advances past rounds actually observed. Null when the source omits it.
     */
    observedRound: Nullable<number>
}

/** An `account_balances` row, or a legacy authority with no row. */
export type ObservedChainState = Pick<
    AccountStateSnapshot,
    'authorityAddress'
> &
    Partial<
        Pick<
            AccountStateSnapshot,
            | 'minBalance'
            | 'status'
            | 'totalAssetsOptedIn'
            | 'totalCreatedAssets'
            | 'totalAppsOptedIn'
        >
    >

export type AccountChangeSignal = {
    /** Whether any of the addresses changed after the cursor. */
    changed: boolean
    /** The chain position (block or round) to pass as the next cursor. */
    cursor: number
}

export type AccountStateReadHint = {
    /** Resources the account held at its last sync; 0 when never synced. */
    priorResourceCount: number
}

export type GetPublicKey = (params: HdIndex) => Promise<Uint8Array>

/** The `useKMS()` call a private-key reveal makes; the hook passes its own. */
export type PrivateKeyKeystore = Pick<
    ReturnType<typeof useKMS>,
    'exportSecp256k1Key'
>

export type MintedAccount = {
    /** Not yet persisted. */
    account: WalletAccount
    seedKeyId: string
    /** This call created the seed, so abandoning the account must remove it. */
    isNewSeed: boolean
}

/** An address the same words control under another key kind. */
export type AlternateImportKind = { seed: LocalKeySeed; address: string }

/** Creation and import for the chain's non-HD `localKeyKinds`. */
export type SingleKeyAccountOps = {
    create(
        request: { seed: LocalKeySeed; id?: string },
        scope: ChainScope,
    ): Promise<MintedAccount>
    /**
     * Awaits `save` on each account before minting the next, so a failure part-way keeps
     * what was already saved. Candidates `isHeld` accepts are skipped before minting where
     * the address is known up front. A kind that can resolve to several accounts returns
     * an array even when it mints one.
     */
    importMnemonic(
        request: {
            seed: LocalKeySeed
            /** Wordlist indices; the caller zeroes them. */
            mnemonicIndices: Uint16Array
            isHeld: (address: string) => boolean
        },
        scope: ChainScope,
        save: (minted: MintedAccount) => Promise<void>,
    ): Promise<WalletAccount | WalletAccount[]>
    /**
     * Two kinds can share a word count, so an import that detected `seed`
     * may have meant another. Returns the on-chain accounts the same words
     * control under the other kinds. Advisory, so it never blocks an import:
     * a failed probe reads as none.
     */
    findAlternateImportKinds(
        seed: LocalKeySeed,
        /** Wordlist indices; the caller zeroes them. */
        mnemonicIndices: Uint16Array,
        scope: ChainScope,
    ): Promise<readonly AlternateImportKind[]>
}

/** The chain-specific half of account state, discovery, creation and rekey; registered by the chain package. */
export interface AccountsChainAdapter {
    readonly chainId: ChainId
    fetchAccountState(
        address: string,
        scope: ChainScope,
        hint: AccountStateReadHint,
    ): Promise<AccountStateSnapshot>
    /**
     * The chain's `AccountChainState` for state read back from storage; a sync
     * already carries it as `AccountStateSnapshot.chainState`. A field left out
     * takes its `account_balances` column default. `minBalance` arrives in
     * display units.
     */
    toChainState(observed: ObservedChainState): AccountChainState
    /** Opt-in round per held asset, keyed by asset id. Absent on a chain without opt-in. */
    fetchAssetOptInRounds?(
        address: string,
        scope: ChainScope,
    ): Promise<Map<string, number>>
    /**
     * Whether a sync pass has anything to read. A null cursor has never
     * synced, so it always reports a change. Absent on a chain whose change
     * signal lives outside the adapter.
     */
    fetchChangeSignal?(
        addresses: string[],
        scope: ChainScope,
        cursor: Nullable<number>,
    ): Promise<AccountChangeSignal>
    /** Any on-chain footprint counts, not only a funded balance. */
    accountExists(address: string, scope: ChainScope): Promise<boolean>
    /**
     * Batch activity probe for HD discovery. Never rejects: a failed probe
     * reads as inactive so the gap limit still ends the scan.
     */
    checkActivity(
        addresses: string[],
        scope: ChainScope,
    ): Promise<Map<string, boolean>>
    /** Public keys from an in-memory root key, for discovery before the seed is persisted. */
    createPublicKeyGetter(rootKey: Uint8Array): GetPublicKey
    /**
     * Keystore id of the HD child at these coordinates, computed without
     * deriving. Stored accounts reference this id, so its format never changes,
     * and it must equal the `keyPairId` the chain's `KeyDerivation` returns.
     */
    hdKeyPairId(seedKeyId: string, index: HdIndex): string
    /** Throws `InvalidBip44PathError` when `hdPath` is malformed or names other coordinates. */
    assertHdPathMatches(hdPath: string, index: HdIndex): void
    /** Every software key kind the chain mints, in auto-detection order. */
    readonly localKeyKinds: readonly LocalKeyKind[]
    /** Which of two accounts sharing an address on this chain survives: higher wins. */
    duplicateRank(account: WalletAccount): number
    readonly presentation: AccountPresentationOps
    /** The devices API `account_type`; `null` for an account the chain doesn't register. Absent on a chain without notifications. */
    deviceAccountType?(account: WalletAccount): string | null
    /**
     * The custody and chain entries of an account record the store persisted
     * before it held only those, or `undefined` when the record isn't this
     * chain's. Runs during hydration, so it never throws.
     */
    decodeLegacyRecord(raw: unknown): DecodedAccountRecord | undefined
    /** Absent on a chain whose only software accounts are HD. */
    readonly singleKeyAccounts?: SingleKeyAccountOps
    /**
     * Reads a standalone account's private key back from the keystore. The
     * caller zeroes the bytes. Absent on a chain whose standalone secret is a
     * mnemonic, which the passphrase flow shows instead.
     */
    revealPrivateKey?(
        keystore: PrivateKeyKeystore,
        keyPairId: string,
        domain: string,
    ): Promise<Uint8Array>
    /** Accounts whose signer is `authorityAddress`. Absent on a chain without rekey. */
    fetchRekeyedAddresses?(
        authorityAddress: string,
        scope: ChainScope,
    ): Promise<string[]>
    /** Absent on a chain whose signing authority can't move to another account. */
    readonly authority?: AccountAuthorityOps
    /** `account` need not be in `accounts`; whatever signs for it must be. */
    resolveSigner(
        account: WalletAccount,
        accounts: WalletAccount[],
        scope: ChainScope,
    ): SignerResolution
    /**
     * The account whose key authorises `account` (itself when nothing is
     * delegated), with no signability check. Null only when that account isn't
     * held.
     */
    getAuthAccount(
        account: WalletAccount,
        accounts: WalletAccount[],
        scope: ChainScope,
    ): WalletAccount | null
    /**
     * Fills in record data this chain needs that older records lack, or
     * returns `account` itself. May read the keystore.
     */
    backfillRecord?(account: WalletAccount): WalletAccount
}

export const accountsChainAdapters =
    createChainAdapterRegistry<AccountsChainAdapter>('accounts')

/** Derivation options for the chain's HD key kind on `scope`. */
export const hdDeriveOpts = (scope: ChainScope): DeriveOpts => {
    const hdKind = accountsChainAdapters
        .get(scope.chainId)
        .localKeyKinds.find(kind => kind.isHd)
    if (!hdKind) {
        throw new HdAccountsUnsupportedError(scope.chainId)
    }
    return { scheme: hdKind.signingScheme, networkId: scope.networkId }
}

/** Derives the HD child through the chain's registered `KeyDerivation`. */
export const deriveHdAccount = async (
    scope: ChainScope,
    seedKeyId: string,
    { account, keyIndex }: HdIndex,
) =>
    keyDerivations
        .get(scope.chainId)
        .deriveAccount(
            kmsCore,
            seedKeyId,
            account,
            keyIndex,
            hdDeriveOpts(scope),
        )

/** Throws {@link RekeyUnsupportedError} on a chain without rekey. */
export const requireRekey = (
    adapter: AccountsChainAdapter,
): NonNullable<AccountsChainAdapter['fetchRekeyedAddresses']> => {
    if (!adapter.fetchRekeyedAddresses) {
        throw new RekeyUnsupportedError(adapter.chainId)
    }
    return adapter.fetchRekeyedAddresses.bind(adapter)
}

/** Throws {@link SingleKeyAccountsUnsupportedError} on a chain without single-key accounts. */
export const requireSingleKeyAccounts = (
    adapter: AccountsChainAdapter,
): SingleKeyAccountOps => {
    if (!adapter.singleKeyAccounts) {
        throw new SingleKeyAccountsUnsupportedError(adapter.chainId)
    }
    return adapter.singleKeyAccounts
}

/** Rejects with {@link RekeyUnsupportedError} on a chain without rekey. */
export const fetchRekeyedAddresses = async (
    authorityAddress: string,
    scope: ChainScope,
): Promise<string[]> =>
    requireRekey(accountsChainAdapters.get(scope.chainId))(
        authorityAddress,
        scope,
    )

/** Empty on a chain without asset opt-in. */
export const fetchAssetOptInRounds = async (
    address: string,
    scope: ChainScope,
): Promise<Map<string, number>> => {
    const adapter = accountsChainAdapters.get(scope.chainId)
    return adapter.fetchAssetOptInRounds
        ? adapter.fetchAssetOptInRounds(address, scope)
        : new Map()
}
