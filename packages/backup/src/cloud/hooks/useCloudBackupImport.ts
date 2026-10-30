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

import { useCallback, useMemo } from 'react'
import {
    buildAccount,
    chainAccountOf,
    deriveClaimedHdKey,
    DuplicateAccountError,
    findAddressHolder,
    findPathHolder,
    hasCustody,
    isSameAddress,
    useAccountsStore,
    useImportAccount,
    useUpdateAccount,
    type HardwareWalletAccount,
    type LocalAccount,
    type LocalKeySeed,
    type MultiSigAccount,
    type WalletAccount,
    type WatchAccount,
    withEnablement,
    withMultisigParameters,
    type ChainEnabledBy,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    hexToBytes,
    kmsCore,
    mnemonicWordsToIndices,
    useKMS,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'
import {
    generateOrderedUniqueId,
    logger,
    toError,
    type Maybe,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    backupAdapterFor,
    backupChainAdapters,
    type BackupChainAdapter,
} from '../../chain-adapter'
import { useMarkMnemonicBackupComplete } from '../../mnemonic/hooks'
import {
    BackupAccountType,
    hdPositionOf,
    isChainAddressPayload,
    isChainHdAddressPayload,
    isHdSeedSecretsPayload,
    type ChainAddressPayload,
    type ChainHdAddressPayload,
    type HardwareAddressPayload,
    type HdChainAddressPayload,
    type MultisigAddressPayload,
    type SecretsBackupPayload,
    type StandaloneKeyAddressPayload,
    type WatchAddressPayload,
} from '../models'
import type { PulledAccount } from '../restore/pullBackupItems'
import {
    UnsupportedBackupAccountTypeError,
    type ImportProgressFn,
    type ImportSummary,
    type SyncImportFn,
} from '../sync/types'

type ImportFailure = ImportSummary['failed'][number]

export type UseCloudBackupImportResult = {
    importAccounts: SyncImportFn
}

type ImportContext = Pick<
    ReturnType<typeof useKMS>,
    'keys' | 'hasSeedWithEntropy' | 'persistHDMasterKey'
> & {
    adapter: BackupChainAdapter
    scope: ChainScope
    importAccount: ReturnType<typeof useImportAccount>
    updateAccount: ReturnType<typeof useUpdateAccount>
    appendAccount: (account: WalletAccount) => void
    replaceAccount: (account: WalletAccount) => void
    markBackedUp: (account: WalletAccount) => void
}

/** XHD root key (`kL || kR || chainCode`) length expected by `persistHDMasterKey`. */
const XHD_ROOT_LENGTH = 96

const toFailureReason = (error: unknown): string => toError(error).message

const nameField = (
    customName: Maybe<string>,
): { name: string } | Record<string, never> =>
    customName ? { name: customName } : {}

/** A record that carries enablement restores its entries as `'restore'`; one
 *  written before enablement was recorded restores them as created. */
const restoreStampOf = (
    payload: PulledAccount['addressPayload'],
): ChainEnabledBy =>
    'enabledBy' in payload && payload.enabledBy !== undefined
        ? 'restore'
        : 'created'

const assertValidAddress = (chainId: ChainId, address: string): void => {
    if (!addressCodecs.get(chainId).isValid(address)) {
        throw new Error(`Invalid ${chainId} address: ${address}`)
    }
}

const buildHardwareAccount = (
    chainId: ChainId,
    payload: HardwareAddressPayload,
): HardwareWalletAccount => {
    assertValidAddress(chainId, payload.address)
    return buildAccount({
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: payload.manufacturer,
                deviceId: payload.deviceId,
                deviceName: payload.deviceName,
                transportType: payload.transportType,
            },
            accountIndex: payload.accountIndex,
        },
        chainId,
        chains: { [chainId]: { address: payload.address } },
        ...nameField(payload.customName),
    })
}

const buildWatchAccount = (
    chainId: ChainId,
    payload: WatchAddressPayload,
): WatchAccount => {
    assertValidAddress(chainId, payload.address)
    return buildAccount({
        custody: { kind: 'watch' },
        chainId,
        chains: { [chainId]: { address: payload.address } },
        ...nameField(payload.customName),
    })
}

const buildMultisigAccount = (
    chainId: ChainId,
    payload: MultisigAddressPayload,
): MultiSigAccount => {
    const multisig = multisigChainAdapters.get(chainId)
    const parameters = {
        version: payload.version,
        threshold: payload.threshold,
        addresses: payload.participantAddresses,
    }
    const derived = multisig.deriveAddress(parameters)
    if (derived !== payload.address) {
        throw new Error(
            `Multisig address mismatch: derived ${derived} != backup ${payload.address}`,
        )
    }
    return withMultisigParameters(
        buildAccount({
            custody: { kind: 'multisig' },
            chainId,
            chains: { [chainId]: { address: payload.address } },
            ...nameField(payload.customName),
        }),
        chainId,
        parameters,
    )
}

// Only a bip39 seed derives HD children.
type HdSeed = Extract<LocalKeySeed, 'bip39'>

const buildHdWalletAccount = async (
    adapter: BackupChainAdapter,
    seed: HdSeed,
    seedKeyId: string,
    payload: ChainHdAddressPayload,
): Promise<LocalAccount> => {
    // Derivation also commits the child key to the keystore, so no separate
    // `generateDerivedKey` call is needed here.
    const index = { account: payload.account, keyIndex: payload.keyIndex }
    const derived = await deriveClaimedHdKey(
        adapter.chainId,
        seedKeyId,
        index,
        () =>
            adapter.deriveHdAccount(kmsCore, seedKeyId, {
                ...index,
                derivationType: payload.derivationType,
            }),
    )
    if (derived.address !== payload.address) {
        throw new Error(
            `${payload.type} address mismatch: derived ${derived.address} != backup ${payload.address}`,
        )
    }
    return buildAccount({
        custody: {
            kind: 'local',
            seed,
            hd: { account: payload.account, keyIndex: payload.keyIndex },
        },
        chainId: adapter.chainId,
        chains: {
            [adapter.chainId]: {
                address: payload.address,
                keyPairId: derived.keyPairId,
            },
        },
        ...nameField(payload.customName),
    })
}

/**
 * Routed through `useImportAccount` rather than minting keys here so keystore
 * custody stays in one place, and because some seed schemes need that path's
 * on-chain probe across derivations. Returns the accounts the wallet gained,
 * which can be more than one for a single phrase.
 */
const importFromMnemonic = async (
    { importAccount, updateAccount, scope }: ImportContext,
    seed: LocalKeySeed,
    addressPayload: ChainAddressPayload,
    secretsPayload: Nullable<SecretsBackupPayload>,
): Promise<WalletAccount[]> => {
    const { type } = addressPayload
    if (
        !secretsPayload ||
        !('mnemonic' in secretsPayload) ||
        secretsPayload.type !== type
    ) {
        throw new Error(`${type} account missing mnemonic secret`)
    }
    const mnemonicIndices = mnemonicWordsToIndices(
        secretsPayload.mnemonic.split(' '),
    )
    if (!mnemonicIndices) {
        throw new Error(`${type} account has an unreadable mnemonic secret`)
    }
    let result
    try {
        result = await importAccount({ mnemonicIndices, seed })
    } finally {
        zeroBytes(mnemonicIndices)
    }
    const returned = Array.isArray(result) ? result : [result]
    // An HD import is the only one that resolves to a pending handle instead
    // of accounts, and it never reaches this path.
    if (returned.some(account => !('custody' in account))) {
        throw new Error(`Unexpected non-account result for ${type} import`)
    }
    const imported = returned as WalletAccount[]
    if (addressPayload.customName) {
        const match = findAddressHolder(imported, scope, addressPayload.address)
        if (match) {
            updateAccount({ ...match, name: addressPayload.customName })
        }
    }
    return imported
}

/**
 * `seed` is hex of the exact 96-byte XHD root that `persistHDMasterKey` stores,
 * so no BIP39 `fromSeed` step is needed. RN-internal format — Android uses
 * base64 + entropy-driven import and is not yet interoperable.
 */
const persistSeedFromBackup = async (
    { adapter, persistHDMasterKey }: ImportContext,
    secretsPayload: { seed: string; entropy: string },
): Promise<{ seedKeyId: string; firstDerivedAddress: string }> => {
    if (secretsPayload.seed.length % 2 !== 0) {
        throw new Error('hdSeed seed hex must have an even length')
    }
    const rootKey = hexToBytes(secretsPayload.seed)
    if (rootKey.length !== XHD_ROOT_LENGTH) {
        throw new Error(
            `Unexpected HD seed length ${rootKey.length}; expected ${XHD_ROOT_LENGTH}-byte XHD root`,
        )
    }
    const entropy = hexToBytes(secretsPayload.entropy)
    const seedKeyId = generateOrderedUniqueId()
    // `persistHDMasterKey` zeroes `rootKey`/`entropy` in a finally.
    await persistHDMasterKey({ keyId: seedKeyId, rootKey, entropy })

    return {
        seedKeyId,
        firstDerivedAddress: await adapter.seedReference(kmsCore, seedKeyId),
    }
}

/**
 * Restoring onto a wallet that already holds a seed must reuse it:
 * `persistHDMasterKey` mints a fresh id and entropy child every call, so an
 * unguarded re-restore orphans a second copy of the user's HD root.
 */
const resolveHeldSeeds = async ({
    adapter,
    keys,
    hasSeedWithEntropy,
}: ImportContext): Promise<Map<string, string>> => {
    const held = new Map<string, string>()
    for (const seedKeyId of keys.keys()) {
        // Only bip39 roots — single-key seeds have no entropy child and
        // nothing to derive an address path against.
        if (!hasSeedWithEntropy(seedKeyId)) continue
        try {
            held.set(await adapter.seedReference(kmsCore, seedKeyId), seedKeyId)
        } catch (error) {
            // A seed we can't derive against can't be matched, so it just
            // doesn't participate in the guard.
            logger.warn(
                'useCloudBackupImport: failed to derive held seed address',
                { seedKeyId, reason: toFailureReason(error) },
            )
        }
    }
    return held
}

/**
 * Runs before the main loop so HD children can derive against their
 * parent. Failures are returned rather than thrown: a seed that can't be
 * persisted costs only its own accounts.
 */
const importSeeds = async (
    context: ImportContext,
    accounts: PulledAccount[],
): Promise<{
    seedKeyIdByFirstDerivedAddress: Map<string, string>
    failures: ImportFailure[]
}> => {
    const seedKeyIdByFirstDerivedAddress = new Map<string, string>()
    const failures: ImportFailure[] = []

    // A held seed is resolved for any entry that derives from one, not only
    // when the batch carries the seed itself: a lone child arriving by sync, or
    // a restore onto a device that already holds the wallet, derives against it.
    const needsSeeds = accounts.some(
        ({ addressPayload, secretsPayload }) =>
            (!!secretsPayload && isHdSeedSecretsPayload(secretsPayload)) ||
            hdPositionOf(addressPayload) !== null,
    )
    if (!needsSeeds) {
        return { seedKeyIdByFirstDerivedAddress, failures }
    }

    const heldSeedKeyIdByFirstDerivedAddress = await resolveHeldSeeds(context)
    for (const [reference, seedKeyId] of heldSeedKeyIdByFirstDerivedAddress) {
        seedKeyIdByFirstDerivedAddress.set(reference, seedKeyId)
    }

    for (const { address, secretsPayload } of accounts) {
        if (!secretsPayload || !isHdSeedSecretsPayload(secretsPayload)) continue
        try {
            // The serializer always sets the seed payload's `address` to the
            // first-derived address.
            const heldSeedKeyId =
                heldSeedKeyIdByFirstDerivedAddress.get(address)
            if (heldSeedKeyId) {
                seedKeyIdByFirstDerivedAddress.set(address, heldSeedKeyId)
                continue
            }
            const { seedKeyId, firstDerivedAddress } =
                await persistSeedFromBackup(context, secretsPayload)
            seedKeyIdByFirstDerivedAddress.set(firstDerivedAddress, seedKeyId)
        } catch (error) {
            const reason = toFailureReason(error)
            logger.warn('useCloudBackupImport: failed to import HD seed', {
                address,
                reason,
            })
            failures.push({ address, reason })
        }
    }

    return { seedKeyIdByFirstDerivedAddress, failures }
}

const importHdWalletAccount = async (
    context: ImportContext,
    adapter: BackupChainAdapter,
    seed: HdSeed,
    payload: ChainHdAddressPayload,
    seedKeyIdByFirstDerivedAddress: Map<string, string>,
): Promise<void> => {
    const seedKeyId = seedKeyIdByFirstDerivedAddress.get(
        payload.seedFirstDerivedAddress,
    )
    if (!seedKeyId) {
        throw new Error(
            `No parent seed for ${payload.type} (seedFirstDerivedAddress=${payload.seedFirstDerivedAddress})`,
        )
    }
    const account = await buildHdWalletAccount(
        adapter,
        seed,
        seedKeyId,
        payload,
    )
    const { chainId } = adapter
    const holder = findPathHolder(
        useAccountsStore.getState().accounts,
        seedKeyId,
        { account: payload.account, keyIndex: payload.keyIndex },
    )
    // The account at this position may already exist from another chain's
    // entry, and a second one would split a single wallet account in two.
    if (!holder || chainAccountOf(holder, chainId)) {
        context.appendAccount(account)
        return
    }
    context.replaceAccount({
        ...holder,
        chains: { ...holder.chains, [chainId]: account.chains[chainId] },
    })
}

/** Returns 1 when the call created the account, 0 when it added this chain's
 *  entry to the account already at that position. */
const importHdChainAccount = async (
    chainId: ChainId,
    payload: HdChainAddressPayload,
    seedKeyIdByFirstDerivedAddress: Map<string, string>,
): Promise<number> => {
    const seedKeyId = seedKeyIdByFirstDerivedAddress.get(
        payload.seedFirstDerivedAddress,
    )
    if (!seedKeyId) {
        throw new Error(
            `No parent seed for hdChain (seedFirstDerivedAddress=${payload.seedFirstDerivedAddress})`,
        )
    }
    const store = useAccountsStore.getState()
    const before = store.accounts.length
    await store.addChainAccount(
        seedKeyId,
        chainId,
        { account: payload.account, keyIndex: payload.keyIndex },
        payload.customName || undefined,
        payload.address,
        restoreStampOf(payload),
    )
    return useAccountsStore.getState().accounts.length > before ? 1 : 0
}

/** The key is hex only until it is decoded here, and the bytes are zeroed
 *  whether or not the import succeeds. The account's one secret serves every
 *  chain entry: the first imports the key and the rest join the account it
 *  created, the key's address on each chain checked against the entry before
 *  anything is written. Returns 1 when the call created the account. */
const importStandaloneKeyAccount = async (
    chainId: ChainId,
    payload: StandaloneKeyAddressPayload,
    secretsPayload: Nullable<SecretsBackupPayload>,
    groupHolder: Optional<WalletAccount>,
): Promise<number> => {
    if (
        groupHolder &&
        hasCustody(groupHolder, 'local') &&
        groupHolder.custody.seed === null
    ) {
        await useAccountsStore
            .getState()
            .enableChain(groupHolder.id, chainId, restoreStampOf(payload), {
                expectedAddress: payload.address,
            })
        return 0
    }
    if (!secretsPayload || !('privateKey' in secretsPayload)) {
        throw new Error('standaloneKey account missing private key secret')
    }
    const privateKey = hexToBytes(secretsPayload.privateKey)
    const before = useAccountsStore.getState().accounts.length
    try {
        await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(
                chainId,
                privateKey,
                payload.customName || undefined,
                payload.address,
                { enabledBy: restoreStampOf(payload), shouldDiscover: false },
            )
    } finally {
        zeroBytes(privateKey)
    }
    return useAccountsStore.getState().accounts.length > before ? 1 : 0
}

/** A watch account on several chains comes as one entry per chain; the first
 *  creates the account and the rest join it. False when there is none to join,
 *  or the slot already holds another address, which then stays as it is. */
const attachWatchChain = (
    context: ImportContext,
    holder: Optional<WalletAccount>,
    chainId: ChainId,
    address: string,
): boolean => {
    if (
        !holder ||
        !hasCustody(holder, 'watch') ||
        chainAccountOf(holder, chainId) !== undefined
    )
        return false
    assertValidAddress(chainId, address)
    context.replaceAccount({
        ...holder,
        chains: {
            ...holder.chains,
            [chainId]: withEnablement({ address }, 'created'),
        },
    })
    return true
}

/** A hardware account on several chains comes as one entry per chain; the
 *  entry joins the account its record restored or already shares an address
 *  with. Never another account at the same device position: a device id can
 *  name a model or be shared by passphrase seeds, and a restore has no device
 *  to read the seed from, so that entry is its own account. */
const attachHardwareChain = (
    context: ImportContext,
    groupHolder: Optional<WalletAccount>,
    chainId: ChainId,
    payload: HardwareAddressPayload,
): boolean => {
    if (
        !groupHolder ||
        !hasCustody(groupHolder, 'hardware') ||
        chainAccountOf(groupHolder, chainId) !== undefined
    )
        return false
    assertValidAddress(chainId, payload.address)
    context.replaceAccount({
        ...groupHolder,
        chains: {
            ...groupHolder.chains,
            [chainId]: withEnablement({ address: payload.address }, 'created'),
        },
    })
    return true
}

const chainOf = (context: ImportContext, account: PulledAccount): ChainId =>
    account.chain ?? context.scope.chainId

/** The account now holding the entry's address, which the rest of its group
 *  join. */
const holderOf = (
    context: ImportContext,
    account: PulledAccount,
): Optional<WalletAccount> => {
    const chainId = chainOf(context, account)
    return useAccountsStore.getState().accounts.find(held => {
        const address = chainAccountOf(held, chainId)?.address
        return (
            address !== undefined &&
            isSameAddress(chainId, address, account.address)
        )
    })
}

/** A legacy item without a name says nothing about it, so only a record
 *  clears one. */
const adoptBackupName = (
    context: ImportContext,
    holder: WalletAccount,
    { chain, addressPayload }: PulledAccount,
): void => {
    if (!('customName' in addressPayload)) return
    const name = addressPayload.customName || undefined
    if (chain === undefined && name === undefined) return
    if ((holder.name || undefined) === name) return
    const { name: _name, ...unnamed } = holder
    context.replaceAccount(name === undefined ? unnamed : { ...holder, name })
}

/**
 * Returns how many accounts the wallet gained — possibly several for one
 * recovery phrase, none for an hdSeed address entry. Throws `DuplicateAccountError` for an address the
 * wallet already holds, which the caller counts apart from a real failure.
 */
const importOneAccount = async (
    context: ImportContext,
    account: PulledAccount,
    seedKeyIdByFirstDerivedAddress: Map<string, string>,
    groupHolder: Optional<WalletAccount>,
): Promise<number> => {
    const { address, addressPayload, secretsPayload } = account
    const chainId = chainOf(context, account)
    const holder = holderOf(context, account)
    if (holder) {
        adoptBackupName(context, holder, account)
        throw new DuplicateAccountError(address)
    }

    if (isChainAddressPayload(addressPayload)) {
        if (!backupChainAdapters.has(chainId)) {
            throw new UnsupportedBackupAccountTypeError(
                addressPayload.type,
                chainId,
            )
        }
        return importChainAccount(
            context,
            backupAdapterFor(chainId),
            addressPayload,
            secretsPayload,
            seedKeyIdByFirstDerivedAddress,
        )
    }

    switch (addressPayload.type) {
        case BackupAccountType.hdSeed: {
            // Seeds are persisted in the pre-pass (the secret rides on
            // secrets/<firstDerivedAddress>). A standalone hdSeed address entry
            // only appears when its first account was removed — nothing to
            // create.
            return 0
        }

        case BackupAccountType.hardware: {
            if (
                attachHardwareChain(
                    context,
                    groupHolder,
                    chainId,
                    addressPayload,
                )
            )
                return 0
            context.appendAccount(buildHardwareAccount(chainId, addressPayload))
            return 1
        }

        case BackupAccountType.watch: {
            if (attachWatchChain(context, groupHolder, chainId, address))
                return 0
            context.appendAccount(buildWatchAccount(chainId, addressPayload))
            return 1
        }

        case BackupAccountType.multisig: {
            context.appendAccount(buildMultisigAccount(chainId, addressPayload))
            return 1
        }

        case BackupAccountType.hdChain: {
            return importHdChainAccount(
                chainId,
                addressPayload,
                seedKeyIdByFirstDerivedAddress,
            )
        }

        case BackupAccountType.standaloneKey: {
            return importStandaloneKeyAccount(
                chainId,
                addressPayload,
                secretsPayload,
                groupHolder,
            )
        }

        default: {
            const unhandled: never = addressPayload
            throw new Error(
                `Unhandled backup item: ${JSON.stringify(unhandled)}`,
            )
        }
    }
}

/** Decoded by the chain's adapter alone: a kind it doesn't define fails here
 *  rather than restoring as some other kind. */
const importChainAccount = async (
    context: ImportContext,
    adapter: BackupChainAdapter,
    addressPayload: ChainAddressPayload,
    secretsPayload: Nullable<SecretsBackupPayload>,
    seedKeyIdByFirstDerivedAddress: Map<string, string>,
): Promise<number> => {
    const local = adapter.localKindOf(addressPayload.type)
    if (!local) {
        throw new UnsupportedBackupAccountTypeError(
            addressPayload.type,
            adapter.chainId,
        )
    }
    if (!local.isHd) {
        if (isChainHdAddressPayload(addressPayload)) {
            throw new Error(
                `${addressPayload.type} item names a parent seed for a single key`,
            )
        }
        const imported = await importFromMnemonic(
            context,
            local.seed,
            addressPayload,
            secretsPayload,
        )
        return imported.length
    }
    if (!isChainHdAddressPayload(addressPayload)) {
        throw new Error(`${addressPayload.type} item records no parent seed`)
    }
    if (local.seed !== 'bip39') {
        throw new Error(`${addressPayload.type} item names no HD seed`)
    }
    await importHdWalletAccount(
        context,
        adapter,
        local.seed,
        addressPayload,
        seedKeyIdByFirstDerivedAddress,
    )
    return 1
}

/**
 * One account can fail twice — a corrupt seed in the pre-pass, then its
 * HD child with "no parent seed". Keeps the first, which is more specific.
 */
const dedupeFailuresByAddress = (
    failures: ImportFailure[],
): ImportFailure[] => {
    const seen = new Set<string>()
    return failures.filter(failure => {
        if (seen.has(failure.address)) return false
        seen.add(failure.address)
        return true
    })
}

const IMPORT_STAGE_BY_FORMAT_KIND: Partial<Record<BackupAccountType, number>> =
    {
        [BackupAccountType.hdChain]: 1,
        [BackupAccountType.standaloneKey]: 2,
    }

/** An `hdChain` entry derives against the seed the pre-pass restored, and an
 *  entry of an earlier stage claims an address a later one shares. */
const importStageOf = ({ addressPayload }: PulledAccount): number => {
    // A chain kind is the backup file's own string, so it never indexes the map.
    if (isChainAddressPayload(addressPayload)) return 0
    return IMPORT_STAGE_BY_FORMAT_KIND[addressPayload.type] ?? 0
}

/** The entries of one wallet account, in the order its record lists them.
 *  Groups run in order of their earliest stage. */
const groupByAccount = (pulled: PulledAccount[]): PulledAccount[][] => {
    const groups = new Map<string, PulledAccount[]>()
    for (const entry of pulled) {
        groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry])
    }
    const earliestStage = (entries: PulledAccount[]) =>
        Math.min(...entries.map(importStageOf))
    return [...groups.values()].sort(
        (a, b) => earliestStage(a) - earliestStage(b),
    )
}

/** A seed-only entry restores the seed and creates no account to count. */
const createsAccount = (entries: PulledAccount[]): boolean =>
    entries.some(
        ({ addressPayload }) =>
            addressPayload.type !== BackupAccountType.hdSeed,
    )

/**
 * Builders stamp what they write as created; an entry from a record that
 * carries enablement is restamped here, once its group is in.
 */
const stampRestoredEntries = (
    context: ImportContext,
    accountId: string,
    chainIds: readonly ChainId[],
): void => {
    const holder = useAccountsStore
        .getState()
        .accounts.find(account => account.id === accountId)
    if (!holder || chainIds.length === 0) return
    const enabledAt = Date.now()
    const chains = { ...holder.chains }
    for (const chainId of chainIds) {
        const entry = chains[chainId]
        if (entry)
            chains[chainId] = { ...entry, enabledAt, enabledBy: 'restore' }
    }
    context.replaceAccount({ ...holder, chains })
}

const importBatch = async (
    context: ImportContext,
    pulled: PulledAccount[],
    onProgress?: ImportProgressFn,
): Promise<ImportSummary> => {
    const groups = groupByAccount(pulled)
    // Progress counts wallet accounts, not backup entries: one account on ten
    // chains is "1 of 1", not "10 of 10".
    const total = groups.filter(createsAccount).length
    const heldIds = new Set(
        useAccountsStore.getState().accounts.map(account => account.id),
    )
    let done = 0
    onProgress?.(0, total)
    const { seedKeyIdByFirstDerivedAddress, failures } = await importSeeds(
        context,
        groups.flat(),
    )
    const summary: ImportSummary = {
        imported: 0,
        skippedDuplicate: 0,
        failed: [...failures],
    }

    const restoredAccountIds = new Set<string>()
    for (const entries of groups) {
        // Any entry the wallet already holds names the account, wherever the
        // record lists it. Kept by id: each entry can rename or extend the
        // account, and a join spreads the copy it is handed.
        let groupHolderId = entries
            .map(account => holderOf(context, account))
            .find(holder => holder !== undefined)?.id
        const restoredChains: ChainId[] = []
        let hasRestoredEntry = false
        for (const account of entries) {
            const groupHolder = useAccountsStore
                .getState()
                .accounts.find(held => held.id === groupHolderId)
            try {
                summary.imported += await importOneAccount(
                    context,
                    account,
                    seedKeyIdByFirstDerivedAddress,
                    groupHolder,
                )
                hasRestoredEntry = true
                if (restoreStampOf(account.addressPayload) === 'restore') {
                    restoredChains.push(chainOf(context, account))
                }
            } catch (error) {
                if (error instanceof DuplicateAccountError) {
                    summary.skippedDuplicate += 1
                } else {
                    const reason = toFailureReason(error)
                    logger.warn(
                        'useCloudBackupImport: failed to import account',
                        { address: account.address, reason },
                    )
                    summary.failed.push({ address: account.address, reason })
                }
            }
            groupHolderId ??= holderOf(context, account)?.id
        }
        // An account already on the device restored nothing, so it is left
        // to the probes it had when it was added.
        if (groupHolderId !== undefined && hasRestoredEntry) {
            restoredAccountIds.add(groupHolderId)
            stampRestoredEntries(context, groupHolderId, restoredChains)
        }
        if (createsAccount(entries)) {
            done += 1
            onProgress?.(done, total)
        }
    }

    // The backup holds their recovery phrases, so none needs a manual backup.
    for (const account of useAccountsStore.getState().accounts) {
        if (!heldIds.has(account.id)) context.markBackedUp(account)
    }

    // Sequential, and after every group: a probe enables chains on an account
    // the rest of the batch could otherwise still be joining entries to.
    const { discoverChains } = useAccountsStore.getState()
    for (const accountId of restoredAccountIds) {
        await discoverChains(accountId)
    }

    summary.failed = dedupeFailuresByAddress(summary.failed)
    return summary
}

const useImportContext = (
    scope: ChainScope,
): Omit<ImportContext, 'adapter'> => {
    const importAccount = useImportAccount(scope)
    const updateAccount = useUpdateAccount()
    const { keys, hasSeedWithEntropy, persistHDMasterKey } = useKMS()
    const markBackedUp = useMarkMnemonicBackupComplete(scope.chainId)
    // Reading the hook-subscribed snapshot would close over a single render's
    // account list, so back-to-back appends in the loop would clobber each
    // other. We always read+write the live store instead.
    const setAccounts = useAccountsStore(state => state.setAccounts)

    return useMemo(
        () => ({
            scope,
            keys,
            hasSeedWithEntropy,
            persistHDMasterKey,
            importAccount,
            updateAccount,
            markBackedUp,
            appendAccount: newAccount =>
                setAccounts([
                    ...useAccountsStore.getState().accounts,
                    newAccount,
                ]),
            replaceAccount: updated =>
                setAccounts(
                    useAccountsStore
                        .getState()
                        .accounts.map(account =>
                            account.id === updated.id ? updated : account,
                        ),
                ),
        }),
        [
            scope,
            keys,
            hasSeedWithEntropy,
            persistHDMasterKey,
            importAccount,
            updateAccount,
            markBackedUp,
            setAccounts,
        ],
    )
}

export const useCloudBackupImport = (
    scope: ChainScope,
): UseCloudBackupImportResult => {
    const context = useImportContext(scope)

    // Resolved before the seed pre-pass so a build without the chain's adapter
    // refuses the whole restore instead of half-importing it.
    const importAccounts = useCallback(
        async (accounts: PulledAccount[], onProgress?: ImportProgressFn) =>
            importBatch(
                {
                    ...context,
                    adapter: backupAdapterFor(context.scope.chainId),
                },
                accounts,
                onProgress,
            ),
        [context],
    )

    return { importAccounts }
}
