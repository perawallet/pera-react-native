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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
    LaunchAccountModes,
    type AccountChains,
    type AccountCustody,
    type AccountsState,
    type AccountSortMode,
    type ChainAccount,
    type EnableChainOptions,
    type HardwareWalletDetails,
    type LaunchAccountMode,
    type RecordedAuthorities,
    type WalletAccount,
} from '../models'
import {
    gateWritesOnHydration,
    guardedPersist,
    logger,
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    addressCodecs,
    CHAIN_IDS,
    keyDerivations,
    toScopeKey,
    type ChainDescriptor,
    type ChainFamily,
    type ChainId,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    getChainDescriptor,
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { kmsCore, zeroBytes } from '@perawallet/wallet-core-kms'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    accountsChainAdapters,
    deriveHdKeyForAccount,
    type DecodedAccountRecord,
} from '../chain-adapter'
import {
    buildAccount,
    canDerive,
    canImportRawKey,
    chainAccountOf,
    defaultChains,
    eligibleChains,
    eligibleChainsInFamily,
    findAddressHolder,
    findHardwareHolder,
    findPathHolder,
    hardwareJoinCandidates,
    isKeyReferenced,
    seedMintableScheme,
    seedOf,
    signingKeyOn,
    withEnablement,
} from '../credentials'
import { standaloneKeySchemes } from '../credentials/eligibility'
import {
    AccountNotFoundError,
    AddressMismatchError,
    ChainNotEligibleError,
    DeviceAddressRequiredError,
    DuplicateAccountError,
    InvalidChainAddressError,
    RawKeyImportUnsupportedError,
    WalletCannotDeriveError,
} from '../errors'
import { useAccountChainStateStore } from './accountChainState'
import {
    isHardwareWalletAccount,
    isSameAddress,
    isWatchAccount,
} from '../utils'

const STORE_NAME = 'accounts-store'
// Bumping this, or changing `migrateAccountsState`, adds the payload the
// outgoing version wrote to conformance/src/suites/store-migration/fixtures.ts.
const STORE_VERSION = 6

type PersistedAccountsState = Pick<
    AccountsState,
    | 'accounts'
    | 'selectedAccountId'
    | 'sortMode'
    | 'manualAccountOrder'
    | 'launchAccountMode'
    | 'launchAccountId'
    | 'authorities'
    | 'unscopedAuthorities'
>

type PersistedRecord = Record<string, unknown> & {
    id?: unknown
    address?: string
}

/** State as v0-v4 persisted it: records carried the legacy fields, and selection was keyed by address. */
type LegacyPersistedState = Partial<
    Omit<PersistedAccountsState, 'accounts'>
> & {
    accounts?: PersistedRecord[]
    selectedAccountAddress?: Nullable<string>
    launchAccountAddress?: Nullable<string>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

/** A record already held only as custody and chain entries, as one for a chain with no accounts adapter can be. */
const currentShapeOf = (
    raw: PersistedRecord,
): DecodedAccountRecord | undefined =>
    isObject(raw.custody) &&
    typeof raw.custody.kind === 'string' &&
    isObject(raw.chains) &&
    Object.keys(raw.chains).length > 0
        ? {
              custody: raw.custody as AccountCustody,
              chains: raw.chains as AccountChains,
          }
        : undefined

const decodeRecord = (raw: PersistedRecord): DecodedAccountRecord | undefined =>
    CHAIN_IDS.flatMap(chainId => {
        if (!accountsChainAdapters.has(chainId)) return []
        const adapter = accountsChainAdapters.get(chainId)
        return adapter.decodeLegacyRecord?.(raw) ?? []
    })[0] ?? currentShapeOf(raw)

const persistedIdOf = (raw: PersistedRecord): string | undefined =>
    typeof raw.id === 'string' && raw.id !== '' ? raw.id : undefined

/**
 * The id for a record persisted without one, derived from its first chain
 * address. It must be the same wherever the migration runs: the extension's
 * popup and offscreen document each migrate the same payload, and a random id
 * would differ between them. The `legacy:` prefix can't collide with the
 * UUIDs `buildAccount` mints.
 */
const derivedIdOf = ({ chains }: DecodedAccountRecord): string => {
    const chainId = CHAIN_IDS.find(id => chains[id])
    return chainId ? `legacy:${chainId}:${chains[chainId]?.address}` : 'legacy'
}

type MigratedRecord = {
    /** The address the record was persisted under before v5, which selection named. */
    legacyAddress: string | undefined
    account: WalletAccount
}

type LiftedAuthorities = Pick<
    PersistedAccountsState,
    'authorities' | 'unscopedAuthorities'
>

/**
 * Files the authority each chain decodes from `raw` under the address the
 * record holds on that chain. Records persisted before v4 carried authority
 * beside their account fields.
 */
const liftLegacyAuthority = (
    raw: PersistedRecord,
    { chains }: DecodedAccountRecord,
    into: LiftedAuthorities,
): void => {
    for (const chainId of CHAIN_IDS) {
        const address = chains[chainId]?.address
        if (address === undefined || !accountsChainAdapters.has(chainId)) {
            continue
        }
        const decoded = accountsChainAdapters
            .get(chainId)
            .decodeLegacyAuthority?.(raw)
        if (!decoded) continue
        for (const [key, authority] of Object.entries(decoded.byScope) as [
            ChainScopeKey,
            string | undefined,
        ][]) {
            if (authority === undefined) continue
            into.authorities[key] = {
                ...into.authorities[key],
                [address]: authority,
            }
        }
        if (decoded.unscoped !== undefined) {
            into.unscopedAuthorities[address] = decoded.unscoped
        }
    }
}

// No migration ever wrote ids, so a record persisted without one gets a
// derived id rather than losing the account.
const migrateRecords = (
    raws: readonly PersistedRecord[],
    lifted: LiftedAuthorities,
): MigratedRecord[] => {
    const usedIds = new Set(raws.flatMap(raw => persistedIdOf(raw) ?? []))
    const uniqueId = (base: string): string => {
        let id = base
        for (let repeat = 2; usedIds.has(id); repeat++) {
            id = `${base}:${repeat}`
        }
        usedIds.add(id)
        return id
    }
    return raws.flatMap(raw => {
        const decoded = decodeRecord(raw)
        if (!decoded) return []
        liftLegacyAuthority(raw, decoded, lifted)
        return [
            {
                legacyAddress:
                    typeof raw.address === 'string' ? raw.address : undefined,
                account: {
                    id: persistedIdOf(raw) ?? uniqueId(derivedIdOf(decoded)),
                    ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
                    ...decoded,
                },
            },
        ]
    })
}

// Before v2 the legacy `type` and details were authoritative, and v1's
// `provenance`/`credentials` were derived from them, so all of it is dropped
// and the legacy fields decode again.
const stripPreV2Custody = (raw: PersistedRecord): PersistedRecord => {
    const rest = { ...raw }
    delete rest.provenance
    delete rest.credentials
    delete rest.custody
    delete rest.chains
    return rest
}

/** The id of the account that held `address` before the migration; `null` when none did. */
const idForLegacyAddress = (
    address: Nullable<string> | undefined,
    records: readonly MigratedRecord[],
): Nullable<string> => {
    if (!address) return null
    return (
        records.find(record => record.legacyAddress === address)?.account.id ??
        null
    )
}

// Entries in `held` win: they were persisted alongside the records the legacy
// fields came from, so they are at least as recent.
const mergeAuthorities = (
    lifted: RecordedAuthorities,
    held: RecordedAuthorities | undefined,
): RecordedAuthorities => {
    const merged: RecordedAuthorities = { ...lifted }
    for (const [key, entries] of Object.entries(held ?? {}) as [
        keyof RecordedAuthorities,
        Record<string, string>,
    ][]) {
        merged[key] = { ...merged[key], ...entries }
    }
    return merged
}

const withoutAddress = <V>(
    entries: Record<string, V>,
    address: string,
): Record<string, V> => {
    if (!(address in entries)) return entries
    const { [address]: _removed, ...rest } = entries
    return rest
}

// Before v5 every record decodes through the registered chain adapters, so
// this runs only after they register (`rehydrateAccountsStore`).
const migrateToV5 = (
    persistedState: unknown,
    version: number,
): PersistedAccountsState => {
    const state = (persistedState ?? {}) as LegacyPersistedState
    const lifted: LiftedAuthorities = {
        authorities: {},
        unscopedAuthorities: {},
    }
    const records = migrateRecords(
        (state.accounts ?? []).map(raw =>
            version < 2 ? stripPreV2Custody(raw) : raw,
        ),
        lifted,
    )
    const accounts = records.map(record => record.account)
    const idOf = (address: Nullable<string> | undefined) =>
        idForLegacyAddress(address, records)
    const launchAccountId = idOf(state.launchAccountAddress)
    return {
        accounts,
        selectedAccountId: idOf(state.selectedAccountAddress),
        sortMode: state.sortMode ?? 'manual',
        manualAccountOrder: (state.manualAccountOrder ?? []).flatMap(
            address => idOf(address) ?? [],
        ),
        launchAccountMode: launchAccountId
            ? (state.launchAccountMode ?? LaunchAccountModes.lastUsed)
            : LaunchAccountModes.lastUsed,
        launchAccountId,
        authorities: mergeAuthorities(lifted.authorities, state.authorities),
        unscopedAuthorities: {
            ...lifted.unscopedAuthorities,
            ...state.unscopedAuthorities,
        },
    }
}

// A fixed 0 rather than the current time: the extension's popup and offscreen
// document each migrate the same payload and must write the same record.
const stampPreRecordEntries = (account: WalletAccount): WalletAccount => ({
    ...account,
    chains: Object.fromEntries(
        Object.entries(account.chains).map(([id, entry]) => [
            id,
            entry ? withEnablement(entry, 'created', 0) : entry,
        ]),
    ),
})

/**
 * Each record keeps only its custody and chain entries, the authority it
 * carried before v4 moving into the authority maps, and a record no chain
 * decodes is dropped. Selection moves from addresses to account ids. Every
 * entry persisted before v6 is recorded as enabled at creation.
 */
export const migrateAccountsState = (
    persistedState: unknown,
    version: number,
): PersistedAccountsState => {
    if (version >= STORE_VERSION) {
        return persistedState as PersistedAccountsState
    }
    const state =
        version >= 5
            ? (persistedState as PersistedAccountsState)
            : migrateToV5(persistedState, version)
    return {
        ...state,
        accounts: (state.accounts ?? []).map(stampPreRecordEntries),
    }
}

type ChainAddress = { chainId: ChainId; address: string }

const chainAddressesOf = (account: WalletAccount): ChainAddress[] =>
    CHAIN_IDS.flatMap(chainId => {
        const address = chainAccountOf(account, chainId)?.address
        return address === undefined ? [] : [{ chainId, address }]
    })

/** The first of `candidate`'s addresses that `existing` also holds on the same chain. */
const sharedChainAddress = (
    candidate: readonly ChainAddress[],
    existing: readonly ChainAddress[],
): ChainAddress | undefined => {
    const existingByChain = new Map(
        existing.map(({ chainId, address }) => [chainId, address]),
    )
    return candidate.find(({ chainId, address }) => {
        const theirs = existingByChain.get(chainId)
        return theirs !== undefined && isSameAddress(chainId, address, theirs)
    })
}

const duplicateRankOn = (chainId: ChainId, account: WalletAccount): number =>
    accountsChainAdapters.has(chainId)
        ? (accountsChainAdapters.get(chainId).duplicateRank?.(account) ?? 0)
        : 0

/**
 * Collapse accounts that hold the same address on the same chain, the
 * account that chain ranks higher winning (`duplicateRank`) and equal ranks
 * keeping the first occurrence. One account holding one address on two
 * chains is not a duplicate. The survivor sits at the index where it *first*
 * collided:
 * `manualAccountOrder`, `selectedAccountId` and the rendered list all read
 * this array, so a dedupe that reorders accounts would be a worse bug than the
 * one it fixes.
 *
 * The winner is kept wholesale — fields are deliberately NOT merged between
 * the two entries. Merging watch state into a signing account is a specific,
 * intentional operation (`upgradeWatchAccountToHardware` below); doing it
 * implicitly here would be far too subtle to reason about at a call site that
 * just wanted to write a list of accounts.
 */
const resolveDuplicateAccounts = (
    accounts: WalletAccount[],
): WalletAccount[] => {
    const resolved: WalletAccount[] = []
    const resolvedAddresses: ChainAddress[][] = []

    for (const account of accounts) {
        const addresses = chainAddressesOf(account)
        let position = -1
        let shared: ChainAddress | undefined
        for (const [index, existing] of resolvedAddresses.entries()) {
            shared = sharedChainAddress(addresses, existing)
            if (shared) {
                position = index
                break
            }
        }
        if (position === -1 || !shared) {
            resolved.push(account)
            resolvedAddresses.push(addresses)
            continue
        }
        if (
            duplicateRankOn(shared.chainId, account) >
            duplicateRankOn(shared.chainId, resolved[position])
        ) {
            resolved[position] = account
            resolvedAddresses[position] = addresses
        }
    }

    return resolved
}

const withoutLocalKey = ({
    address,
    enabledAt,
    enabledBy,
}: ChainAccount): ChainAccount => ({
    address,
    ...(enabledBy !== undefined ? { enabledAt, enabledBy } : {}),
})

const withoutLocalKeys = (chains: AccountChains): AccountChains =>
    Object.fromEntries(
        Object.entries(chains).map(([id, entry]) => [
            id,
            entry ? withoutLocalKey(entry) : entry,
        ]),
    )

/**
 * The account rebound to the hardware wallet, keeping its id, name and chain
 * entries; `chainId` is the chain the device proved its address on.
 */
const rebindToHardware = (
    current: WalletAccount,
    details: HardwareWalletDetails,
    chainId: ChainId,
): WalletAccount | undefined => {
    if (!chainAccountOf(current, chainId)) return undefined
    const { accountIndex, ...device } = details
    return buildAccount({
        id: current.id,
        name: current.name,
        custody: { kind: 'hardware', device, accountIndex },
        chainId,
        chains: withoutLocalKeys(current.chains),
    })
}

/** `holder` with `source`'s entries, keyless, on the chains it has none of. */
const withEntriesOf = (
    holder: WalletAccount,
    source: WalletAccount,
): WalletAccount => {
    const chains: AccountChains = { ...holder.chains }
    for (const [id, entry] of Object.entries(withoutLocalKeys(source.chains))) {
        const chainId = id as ChainId
        if (entry && !chains[chainId]) chains[chainId] = entry
    }
    return { ...holder, chains }
}

/** Removes a KMS entry no account references; a failure is logged so the caller's own error is the one thrown. */
const removeUnreferencedKey = async (
    accounts: readonly WalletAccount[],
    keyPairId: string,
): Promise<void> => {
    if (isKeyReferenced(accounts, keyPairId)) return
    try {
        await getProvider().key.store.remove(keyPairId)
    } catch (error) {
        logger.warn(
            `Could not remove an unreferenced imported key: ${error instanceof Error ? error.message : 'unknown error'}`,
        )
    }
}

const assertExpectedAddress = (
    chainId: ChainId,
    derived: string,
    expected: string | undefined,
): void => {
    if (expected !== undefined && !isSameAddress(chainId, derived, expected)) {
        throw new AddressMismatchError(expected, derived)
    }
}

// Structural over the union of keys (all scalar) so a future device field
// can't silently skip a re-bind by being left out of a hand-listed check.
const sameDevice = (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
): boolean =>
    [...new Set([...Object.keys(a), ...Object.keys(b)])].every(
        key => a[key] === b[key],
    )

const holdsAddressOn = (
    accounts: readonly WalletAccount[],
    address: string,
    chainId: ChainId,
): boolean =>
    accounts.some(account => {
        const held = chainAccountOf(account, chainId)?.address
        return held !== undefined && isSameAddress(chainId, held, address)
    })

const scopeOn = (chainId: ChainId): ChainScope => ({
    chainId,
    networkId: selectChainNetworkId(useNetworkStore.getState(), chainId),
})

const enabledDescriptors = (account: WalletAccount): ChainDescriptor[] =>
    getProvider()
        .chains.list()
        .filter(({ id }) => chainAccountOf(account, id) !== undefined)

/** The key a standalone account signs with in each family it is enabled in. */
const standaloneKeysByFamily = (
    account: WalletAccount,
    enabled: readonly ChainDescriptor[],
): Map<ChainFamily, string> => {
    const keys = new Map<ChainFamily, string>()
    for (const { id, family } of enabled) {
        const keyPairId = signingKeyOn(account, id)
        if (keyPairId !== undefined && !keys.has(family)) {
            keys.set(family, keyPairId)
        }
    }
    return keys
}

const firstHeldAddress = (account: WalletAccount): string | undefined =>
    CHAIN_IDS.map(id => chainAccountOf(account, id)?.address).find(
        address => address !== undefined,
    )

/** The entry the account's custody gives it on `chainId`, without writing it. */
const resolveChainEntry = async (
    account: WalletAccount,
    chainId: ChainId,
    { deviceAddress }: EnableChainOptions = {},
): Promise<ChainAccount> => {
    const { networkId } = scopeOn(chainId)
    const { custody } = account
    if (custody.kind === 'local' && custody.seed === 'bip39') {
        const scheme = seedMintableScheme(chainId)
        const walletId = seedOf(account)
        if (scheme === undefined || walletId === undefined) {
            throw new WalletCannotDeriveError(walletId ?? account.id, chainId)
        }
        const { address, keyPairId } = await deriveHdKeyForAccount(
            chainId,
            walletId,
            custody.hd,
            { scheme, networkId },
        )
        return { address, keyPairId }
    }
    if (custody.kind === 'local' && custody.seed === null) {
        const enabled = enabledDescriptors(account)
        const { family } = getChainDescriptor(chainId)
        const scheme = standaloneKeySchemes(enabled).get(family)
        const keyPairId = standaloneKeysByFamily(account, enabled).get(family)
        const publicKey =
            keyPairId === undefined
                ? undefined
                : kmsCore.getKey(keyPairId)?.publicKey
        if (scheme === undefined || keyPairId === undefined || !publicKey) {
            throw new ChainNotEligibleError(account.id, chainId)
        }
        return {
            address: addressCodecs
                .get(chainId)
                .fromPublicKey(publicKey, { scheme, networkId }),
            keyPairId,
        }
    }
    if (custody.kind === 'hardware' && deviceAddress === undefined) {
        throw new DeviceAddressRequiredError(chainId)
    }
    const held =
        custody.kind === 'hardware'
            ? deviceAddress
            : custody.kind === 'watch'
              ? firstHeldAddress(account)
              : undefined
    const codec = addressCodecs.get(chainId)
    if (held === undefined || !codec.isValid(held, networkId)) {
        throw new ChainNotEligibleError(account.id, chainId)
    }
    return { address: codec.normalize(held) }
}

type ProbedChains = {
    active: Map<ChainId, ChainAccount>
    /** Keys derived for chains that turned out inactive; removed once nothing references them. */
    unusedKeys: string[]
}

/**
 * Resolves the account's entry on each chain and asks that chain whether the
 * address has any activity. A chain with no accounts adapter, or whose entry
 * can't be resolved, reads as inactive; the adapter probe never rejects.
 */
const probeChainEntries = async (
    account: WalletAccount,
    chainIds: readonly ChainId[],
): Promise<ProbedChains> => {
    const probed = await Promise.all(
        chainIds.map(async chainId => {
            if (!accountsChainAdapters.has(chainId)) return undefined
            let entry: ChainAccount
            try {
                entry = await resolveChainEntry(account, chainId)
            } catch (error) {
                logger.warn(
                    `Could not resolve an address on ${chainId} to probe: ${error instanceof Error ? error.message : 'unknown error'}`,
                )
                return undefined
            }
            // The contract says the probe never rejects; one that does still
            // reads as inactive rather than losing every other chain's answer.
            const activity = await accountsChainAdapters
                .get(chainId)
                .checkActivity([entry.address], scopeOn(chainId))
                .catch(() => new Map<string, boolean>())
            return {
                chainId,
                entry,
                isActive: activity.get(entry.address) === true,
            }
        }),
    )
    const active = new Map<ChainId, ChainAccount>()
    const unusedKeys: string[] = []
    for (const result of probed) {
        if (!result) continue
        if (result.isActive) {
            active.set(result.chainId, result.entry)
        } else if (result.entry.keyPairId !== undefined) {
            unusedKeys.push(result.entry.keyPairId)
        }
    }
    return { active, unusedKeys }
}

/**
 * `draft` with every active eligible chain enabled as `'discovery'`, the
 * chain it was imported on included. That chain stays only when it is active
 * or nothing else is. Skipped when that chain is the only eligible one, so a
 * single-chain build makes no extra network call. A chain whose address
 * another account already holds is left off.
 */
const withDiscoveredChains = async (
    draft: WalletAccount,
    accounts: readonly WalletAccount[],
    importChainId: ChainId,
): Promise<{ account: WalletAccount; unusedKeys: string[] }> => {
    const eligible = eligibleChainsInFamily(draft)
    if (eligible.length < 2) return { account: draft, unusedKeys: [] }
    const { active, unusedKeys } = await probeChainEntries(draft, eligible)
    const enabledAt = Date.now()
    const chains: AccountChains = { ...draft.chains }
    let hasDiscoveredOtherChain = false
    for (const [chainId, entry] of active) {
        const own = chainAccountOf(draft, chainId)
        if (own) {
            chains[chainId] = { ...own, enabledAt, enabledBy: 'discovery' }
        } else if (!holdsAddressOn(accounts, entry.address, chainId)) {
            chains[chainId] = withEnablement(entry, 'discovery', enabledAt)
            hasDiscoveredOtherChain = true
        }
    }
    if (hasDiscoveredOtherChain && !active.has(importChainId)) {
        delete chains[importChainId]
    }
    return { account: { ...draft, chains }, unusedKeys }
}

const removeUnreferencedKeys = async (
    accounts: readonly WalletAccount[],
    keyPairIds: readonly string[],
): Promise<void> => {
    for (const keyPairId of new Set(keyPairIds)) {
        await removeUnreferencedKey(accounts, keyPairId)
    }
}

/**
 * `draft` with an entry, enabled as `'created'`, on each default chain it is
 * eligible for and lacks. A chain whose entry can't be resolved, or whose
 * address another account holds, is left off; the draft is never written.
 */
export const withDefaultChains = async <A extends WalletAccount>(
    draft: A,
): Promise<A> => {
    const missing = defaultChains(draft).filter(
        chainId => !chainAccountOf(draft, chainId),
    )
    if (missing.length === 0) return draft
    const chains: AccountChains = { ...draft.chains }
    const unusedKeys: string[] = []
    const enabledAt = Date.now()
    for (const chainId of missing) {
        let entry: ChainAccount
        try {
            entry = await resolveChainEntry(draft, chainId)
        } catch (error) {
            logger.warn(
                `Could not add default chain ${chainId}: ${error instanceof Error ? error.message : 'unknown error'}`,
            )
            continue
        }
        const { accounts } = useAccountsStore.getState()
        if (holdsAddressOn(accounts, entry.address, chainId)) {
            if (entry.keyPairId !== undefined) unusedKeys.push(entry.keyPairId)
            continue
        }
        chains[chainId] = withEnablement(entry, 'created', enabledAt)
    }
    const account = { ...draft, chains }
    await removeUnreferencedKeys(
        [...useAccountsStore.getState().accounts, account],
        unusedKeys,
    )
    return account
}

/**
 * Binds `current` to the device at `details`. Its entries join the hardware
 * account `joinId` when that account sits at the Bluetooth device position on
 * none of `current`'s chains, and `current` goes, so one device position stays
 * one account. Otherwise `current` rebinds in place, as it always does over
 * USB: passphrase seeds share a device id, so only a caller that read the
 * joined account's address off the device may name it.
 */
const moveToHardware = (
    get: StoreApi<AccountsState>['getState'],
    set: StoreApi<AccountsState>['setState'],
    current: WalletAccount,
    details: HardwareWalletDetails,
    chainId: ChainId,
    joinId: string | undefined,
): boolean => {
    if (!chainAccountOf(current, chainId)) return false
    const { accounts, selectedAccountId } = get()
    const holder =
        joinId === undefined
            ? undefined
            : hardwareJoinCandidates(
                  accounts.filter(account => account.id !== current.id),
                  details,
                  Object.keys(current.chains) as ChainId[],
              ).find(account => account.id === joinId)
    if (holder) {
        const merged = withEntriesOf(holder, current)
        get().setAccounts(
            accounts.flatMap(account =>
                account.id === current.id
                    ? []
                    : [account.id === holder.id ? merged : account],
            ),
        )
        if (selectedAccountId === current.id) {
            set({ selectedAccountId: holder.id })
        }
        return true
    }
    const rebound = rebindToHardware(current, details, chainId)
    if (!rebound) return false
    set({
        accounts: accounts.map(account =>
            account.id === current.id ? rebound : account,
        ),
    })
    return true
}

const accountQueues = new Map<string, Promise<unknown>>()

/**
 * Runs one chain change at a time per account. A probe drops the keys it
 * derived for inactive chains; run beside an enable that derives the same
 * key, it could drop that key before the enable's entry references it.
 */
const queuedFor = <T>(accountId: string, run: () => Promise<T>): Promise<T> => {
    const queued = (accountQueues.get(accountId) ?? Promise.resolve())
        .catch(() => undefined)
        .then(run)
    accountQueues.set(accountId, queued)
    void queued
        .catch(() => undefined)
        .finally(() => {
            if (accountQueues.get(accountId) === queued) {
                accountQueues.delete(accountId)
            }
        })
    return queued
}

const findAccountById = (
    accounts: readonly WalletAccount[],
    accountId: string,
): WalletAccount => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) throw new AccountNotFoundError(accountId)
    return account
}

const withChainEntry = (
    accounts: readonly WalletAccount[],
    accountId: string,
    additions: AccountChains,
): WalletAccount[] =>
    accounts.map(account =>
        account.id === accountId
            ? { ...account, chains: { ...account.chains, ...additions } }
            : account,
    )

const initialState = {
    accounts: [] as WalletAccount[],
    selectedAccountId: null as Nullable<string>,
    sortMode: 'manual' as AccountSortMode,
    manualAccountOrder: [] as string[],
    launchAccountMode: LaunchAccountModes.lastUsed as LaunchAccountMode,
    launchAccountId: null as Nullable<string>,
    authorities: {} as RecordedAuthorities,
    unscopedAuthorities: {} as Record<string, string>,
}

export const useAccountsStore: UseBoundStore<
    WithPersist<StoreApi<AccountsState>, unknown>
> = create<AccountsState>()(
    guardedPersist(
        (set, get) => ({
            ...initialState,
            getSelectedAccount: () => {
                const { accounts, selectedAccountId } = get()

                if (!selectedAccountId) {
                    return null
                }
                return accounts.find(a => a.id === selectedAccountId) ?? null
            },
            setAccounts: (accounts: WalletAccount[]) => {
                // Single chokepoint for every account write — dedupe by
                // chain address so no caller can ever persist the same account
                // twice, keeping the account its chain ranks higher
                // (`duplicateRank`) rather than whichever happened to come
                // first. Callers that need to surface duplicates to the user
                // use addAccount or throw DuplicateAccountError before
                // reaching here; this is the structural safety net.
                accounts = resolveDuplicateAccounts(accounts)

                const currentSelected = get().selectedAccountId
                const currentManualOrder = get().manualAccountOrder
                set({ accounts })

                const accountIds = new Set(accounts.map(a => a.id))
                if (currentSelected == null && accounts.length) {
                    set({ selectedAccountId: accounts.at(0)?.id })
                } else if (!accountIds.has(currentSelected ?? '')) {
                    set({ selectedAccountId: accounts.at(0)?.id ?? null })
                }

                const prunedOrder = currentManualOrder.filter(id =>
                    accountIds.has(id),
                )
                const newIds = accounts
                    .map(a => a.id)
                    .filter(id => !prunedOrder.includes(id))
                set({ manualAccountOrder: [...prunedOrder, ...newIds] })

                // A launch pin whose account is gone would leave the Launch
                // Settings screen pointing at nothing, so revert it here rather
                // than tolerating a dangling id until the next cold start.
                const { launchAccountMode, launchAccountId } = get()
                if (
                    launchAccountMode === LaunchAccountModes.specific &&
                    !accountIds.has(launchAccountId ?? '')
                ) {
                    set({
                        launchAccountMode: LaunchAccountModes.lastUsed,
                        launchAccountId: null,
                    })
                }
            },
            addAccount: (account: WalletAccount) => {
                const { accounts } = get()
                const candidate = chainAddressesOf(account)
                for (const existing of accounts) {
                    const shared = sharedChainAddress(
                        candidate,
                        chainAddressesOf(existing),
                    )
                    if (shared !== undefined) {
                        throw new DuplicateAccountError(
                            shared.address,
                            existing,
                        )
                    }
                }
                get().setAccounts([...accounts, account])
            },
            importAccountFromPrivateKey: async (
                chainId: ChainId,
                privateKey: Uint8Array,
                name?: string,
                expectedAddress?: string,
                options = {},
            ) => {
                const { enabledBy, shouldDiscover = true } = options
                try {
                    const scheme = canImportRawKey(chainId)
                        ? getChainDescriptor(chainId).signing.rawKeySchemes[0]
                        : undefined
                    if (!scheme) throw new RawKeyImportUnsupportedError(chainId)
                    const networkId = selectChainNetworkId(
                        useNetworkStore.getState(),
                        chainId,
                    )
                    const { keyPairId, address } = await keyDerivations
                        .get(chainId)
                        .importRawKey(kmsCore, privateKey, {
                            scheme,
                            networkId,
                        })
                    try {
                        assertExpectedAddress(chainId, address, expectedAddress)
                        const { accounts } = get()
                        const holder = findAddressHolder(
                            accounts,
                            { chainId, networkId },
                            address,
                        )
                        if (holder)
                            throw new DuplicateAccountError(address, holder)
                        const keyHolder = accounts.find(
                            account =>
                                account.custody.kind === 'local' &&
                                account.custody.seed === null &&
                                isKeyReferenced([account], keyPairId),
                        )
                        if (keyHolder) {
                            return await get().enableChain(
                                keyHolder.id,
                                chainId,
                                enabledBy ?? 'user',
                            )
                        }
                        const draft = buildAccount({
                            name,
                            custody: { kind: 'local', seed: null },
                            chainId,
                            chains: { [chainId]: { address, keyPairId } },
                            enabledBy: enabledBy ?? 'created',
                        })
                        const { account, unusedKeys } = shouldDiscover
                            ? await withDiscoveredChains(
                                  draft,
                                  accounts,
                                  chainId,
                              )
                            : { account: draft, unusedKeys: [] }
                        get().addAccount(account)
                        await removeUnreferencedKeys(get().accounts, unusedKeys)
                        return account
                    } catch (error) {
                        await removeUnreferencedKey(get().accounts, keyPairId)
                        throw error
                    }
                } finally {
                    zeroBytes(privateKey)
                }
            },
            importWatchAccount: async (
                chainId: ChainId,
                address: string,
                name?: string,
            ) => {
                const scope = scopeOn(chainId)
                const codec = addressCodecs.get(chainId)
                if (!codec.isValid(address, scope.networkId)) {
                    throw new InvalidChainAddressError(chainId)
                }
                const normalized = codec.normalize(address)
                const { accounts } = get()
                const holder = findAddressHolder(accounts, scope, normalized)
                if (holder) throw new DuplicateAccountError(normalized, holder)
                const watcher = accounts.find(account => {
                    if (account.custody.kind !== 'watch') return false
                    const held = firstHeldAddress(account)
                    return (
                        held !== undefined &&
                        eligibleChains(account).includes(chainId) &&
                        isSameAddress(chainId, held, normalized)
                    )
                })
                if (watcher) {
                    return get().enableChain(watcher.id, chainId, 'user')
                }
                const draft = buildAccount({
                    name,
                    custody: { kind: 'watch' },
                    chainId,
                    chains: { [chainId]: { address: normalized } },
                })
                const { account } = await withDiscoveredChains(
                    draft,
                    accounts,
                    chainId,
                )
                get().addAccount(account)
                return account
            },
            enableChain: (accountId, chainId, enabledBy, options) =>
                queuedFor(accountId, async () => {
                    const account = findAccountById(get().accounts, accountId)
                    if (chainAccountOf(account, chainId)) return account
                    if (!eligibleChains(account).includes(chainId)) {
                        throw new ChainNotEligibleError(accountId, chainId)
                    }
                    const entry = await resolveChainEntry(
                        account,
                        chainId,
                        options,
                    )
                    try {
                        assertExpectedAddress(
                            chainId,
                            entry.address,
                            options?.expectedAddress,
                        )
                        // Read after the derivation: the store can change across the await.
                        const { accounts } = get()
                        const current = findAccountById(accounts, accountId)
                        if (chainAccountOf(current, chainId)) return current
                        const holder = findAddressHolder(
                            accounts,
                            scopeOn(chainId),
                            entry.address,
                        )
                        if (holder) {
                            throw new DuplicateAccountError(
                                entry.address,
                                holder,
                            )
                        }
                        const next = withChainEntry(accounts, accountId, {
                            [chainId]: withEnablement(entry, enabledBy),
                        })
                        get().setAccounts(next)
                        return findAccountById(next, accountId)
                    } catch (error) {
                        if (entry.keyPairId !== undefined) {
                            await removeUnreferencedKey(
                                get().accounts,
                                entry.keyPairId,
                            )
                        }
                        throw error
                    }
                }),
            discoverChains: (accountId: string) =>
                queuedFor(accountId, async () => {
                    try {
                        const account = findAccountById(
                            get().accounts,
                            accountId,
                        )
                        if (account.custody.kind === 'hardware') return []
                        const candidates = eligibleChainsInFamily(
                            account,
                        ).filter(chainId => !chainAccountOf(account, chainId))
                        if (candidates.length === 0) return []
                        const { active, unusedKeys } = await probeChainEntries(
                            account,
                            candidates,
                        )
                        const { accounts } = get()
                        const current = accounts.find(a => a.id === accountId)
                        const enabledAt = Date.now()
                        const additions: AccountChains = {}
                        for (const [chainId, entry] of active) {
                            if (
                                current &&
                                !chainAccountOf(current, chainId) &&
                                !holdsAddressOn(
                                    accounts,
                                    entry.address,
                                    chainId,
                                )
                            ) {
                                additions[chainId] = withEnablement(
                                    entry,
                                    'discovery',
                                    enabledAt,
                                )
                            } else if (entry.keyPairId !== undefined) {
                                unusedKeys.push(entry.keyPairId)
                            }
                        }
                        const enabled = Object.keys(additions) as ChainId[]
                        if (enabled.length > 0) {
                            get().setAccounts(
                                withChainEntry(accounts, accountId, additions),
                            )
                        }
                        await removeUnreferencedKeys(get().accounts, unusedKeys)
                        return enabled
                    } catch (error) {
                        logger.warn(
                            `Chain discovery failed for ${accountId}: ${error instanceof Error ? error.message : 'unknown error'}`,
                        )
                        return []
                    }
                }),
            addChainAccount: async (
                walletId,
                chainId,
                index,
                name,
                expectedAddress,
                enabledBy = 'created',
            ) => {
                const scheme = seedMintableScheme(chainId)
                if (
                    scheme === undefined ||
                    !canDerive(get().accounts, walletId, chainId)
                ) {
                    throw new WalletCannotDeriveError(walletId, chainId)
                }
                const networkId = selectChainNetworkId(
                    useNetworkStore.getState(),
                    chainId,
                )
                const { address, keyPairId } = await deriveHdKeyForAccount(
                    chainId,
                    walletId,
                    index,
                    { scheme, networkId },
                )

                assertExpectedAddress(chainId, address, expectedAddress)

                // Read after the derivation: the store can change across the await.
                const { accounts } = get()
                const addressHolder = findAddressHolder(
                    accounts,
                    { chainId, networkId },
                    address,
                )
                if (addressHolder) {
                    throw new DuplicateAccountError(address, addressHolder)
                }

                const entry = withEnablement({ address, keyPairId }, enabledBy)
                const holder = findPathHolder(accounts, walletId, index)
                if (!holder) {
                    const account = buildAccount({
                        name,
                        custody: {
                            kind: 'local',
                            seed: 'bip39',
                            hd: {
                                account: index.account,
                                keyIndex: index.keyIndex,
                            },
                        },
                        chainId,
                        chains: { [chainId]: entry },
                    })
                    get().addAccount(account)
                    return account
                }
                const existing = chainAccountOf(holder, chainId)
                if (existing) {
                    throw new DuplicateAccountError(existing.address, holder)
                }
                const updated = {
                    ...holder,
                    chains: { ...holder.chains, [chainId]: entry },
                }
                get().setAccounts(
                    accounts.map(a => (a.id === holder.id ? updated : a)),
                )
                return updated
            },
            addHardwareChainAccount: (
                details,
                chainId,
                address,
                name,
                enabledBy = 'created',
                joinId,
            ) => {
                const scope = scopeOn(chainId)
                const codec = addressCodecs.get(chainId)
                if (!codec.isValid(address, scope.networkId)) {
                    throw new InvalidChainAddressError(chainId)
                }
                const normalized = codec.normalize(address)
                const { accounts } = get()
                const current = findHardwareHolder(
                    accounts.filter(account => {
                        const held = chainAccountOf(account, chainId)
                        return (
                            held !== undefined &&
                            isSameAddress(chainId, held.address, normalized)
                        )
                    }),
                    details,
                )
                if (current) return current
                const addressHolder = findAddressHolder(
                    accounts,
                    scope,
                    normalized,
                )
                if (addressHolder) {
                    throw new DuplicateAccountError(normalized, addressHolder)
                }
                const holder =
                    joinId === undefined
                        ? undefined
                        : hardwareJoinCandidates(accounts, details, [
                              chainId,
                          ]).find(account => account.id === joinId)
                const entry = withEnablement({ address: normalized }, enabledBy)
                if (!holder) {
                    const { accountIndex, ...device } = details
                    const account = buildAccount({
                        name,
                        custody: { kind: 'hardware', device, accountIndex },
                        chainId,
                        chains: { [chainId]: entry },
                    })
                    get().addAccount(account)
                    return account
                }
                const updated = {
                    ...holder,
                    chains: { ...holder.chains, [chainId]: entry },
                }
                get().setAccounts(
                    accounts.map(a => (a.id === holder.id ? updated : a)),
                )
                return updated
            },
            setSelectedAccountId: (id: Nullable<string>) => {
                const accounts = get().accounts
                if (id && !accounts.some(a => a.id === id)) {
                    logger.warn(
                        `Attempted to select account ${id}, but it does not exist in accounts list.`,
                    )
                    return
                }
                set({ selectedAccountId: id })
            },
            setSortMode: (mode: AccountSortMode) => {
                set({ sortMode: mode })
            },
            setLaunchAccountPreference: (
                mode: LaunchAccountMode,
                id?: Nullable<string>,
            ) => {
                if (mode === LaunchAccountModes.lastUsed) {
                    set({
                        launchAccountMode: mode,
                        launchAccountId: null,
                    })
                    return
                }

                const accounts = get().accounts
                if (!id || !accounts.some(a => a.id === id)) {
                    logger.warn(
                        `Attempted to pin launch account ${id}, but it does not exist in accounts list.`,
                    )
                    return
                }
                set({ launchAccountMode: mode, launchAccountId: id })
            },
            applyLaunchAccountPreference: () => {
                const { launchAccountMode, launchAccountId, accounts } = get()
                if (launchAccountMode !== LaunchAccountModes.specific) return
                if (!accounts.some(a => a.id === launchAccountId)) return
                set({ selectedAccountId: launchAccountId })
            },
            setManualAccountOrder: (order: string[]) => {
                set({ manualAccountOrder: order })
            },
            addDelegatedWatchAccounts: (
                sourceAddress: string,
                addresses: string[],
                scope: ChainScope,
            ) => {
                if (addresses.length === 0) return 0

                const current = get().accounts
                const { chainId } = scope
                const newAddresses = addresses.filter(
                    address => !holdsAddressOn(current, address, chainId),
                )
                if (newAddresses.length === 0) return 0

                const watchAccounts = newAddresses.map(address =>
                    buildAccount({
                        custody: { kind: 'watch' },
                        chainId,
                        chains: { [chainId]: { address } },
                    }),
                )
                const adapter = accountsChainAdapters.get(chainId)
                const key = toScopeKey(scope)
                useAccountChainStateStore.getState().fillAccountChainStates({
                    [key]: Object.fromEntries(
                        newAddresses.map(address => [
                            address,
                            adapter.toChainState({
                                authorityAddress: sourceAddress,
                            }),
                        ]),
                    ),
                })

                get().setAccounts([...current, ...watchAccounts])
                get().recordAuthorities({
                    [key]: Object.fromEntries(
                        newAddresses.map(address => [address, sourceAddress]),
                    ),
                })
                return watchAccounts.length
            },
            recordAuthorities: (incoming: RecordedAuthorities) => {
                set({
                    authorities: mergeAuthorities(get().authorities, incoming),
                })
            },
            settleAuthorities: (
                authorities: RecordedAuthorities,
                unscopedAuthorities: Record<string, string> = {},
            ) => {
                set({ authorities, unscopedAuthorities })
            },
            forgetAuthorities: (address: string) => {
                const { authorities, unscopedAuthorities } = get()
                const next: RecordedAuthorities = {}
                for (const [key, entries] of Object.entries(authorities) as [
                    keyof RecordedAuthorities,
                    Record<string, string>,
                ][]) {
                    const kept = withoutAddress(entries, address)
                    if (Object.keys(kept).length > 0) next[key] = kept
                }
                set({
                    authorities: next,
                    unscopedAuthorities: withoutAddress(
                        unscopedAuthorities,
                        address,
                    ),
                })
            },
            upgradeWatchAccountToHardware: (
                id: string,
                hardwareDetails: HardwareWalletDetails,
                chainId: ChainId,
                joinId?: string,
            ) => {
                const current = get().accounts.find(a => a.id === id)
                if (!current || !isWatchAccount(current)) return false
                return moveToHardware(
                    get,
                    set,
                    current,
                    hardwareDetails,
                    chainId,
                    joinId,
                )
            },
            updateHardwareDetails: (
                id: string,
                hardwareDetails: HardwareWalletDetails,
                chainId: ChainId,
                joinId?: string,
            ) => {
                const current = get().accounts.find(a => a.id === id)
                if (!current || !isHardwareWalletAccount(current)) return false

                const { accountIndex, ...device } = hardwareDetails
                const unchanged =
                    current.custody.accountIndex === accountIndex &&
                    sameDevice(current.custody.device, device)
                if (unchanged) return false

                return moveToHardware(
                    get,
                    set,
                    current,
                    hardwareDetails,
                    chainId,
                    joinId,
                )
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            ...gateWritesOnHydration<AccountsState, unknown>(
                STORE_NAME,
                () => getProvider().keyValueStorage,
            ),
            version: STORE_VERSION,
            // `migrate` decodes records through the chain adapters, which
            // register after every module has evaluated: hydrating at import
            // would run it against an empty registry.
            skipHydration: true,
            migrate: migrateAccountsState,
            onRehydrateStorage: () => (_state, error) => {
                if (error) {
                    logger.error(
                        'Accounts store hydration failed; the persisted state is left untouched',
                        { error },
                    )
                }
            },
            partialize: (state): PersistedAccountsState => ({
                accounts: state.accounts,
                selectedAccountId: state.selectedAccountId,
                sortMode: state.sortMode,
                manualAccountOrder: state.manualAccountOrder,
                launchAccountMode: state.launchAccountMode,
                launchAccountId: state.launchAccountId,
                authorities: state.authorities,
                unscopedAuthorities: state.unscopedAuthorities,
            }),
        },
    ),
)

/** Called once the chain adapters are registered; until then the store holds its defaults. */
export const rehydrateAccountsStore = async (): Promise<void> => {
    await useAccountsStore.persist.rehydrate()
}

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useAccountsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useAccountsStore.getState().resetState(),
})
