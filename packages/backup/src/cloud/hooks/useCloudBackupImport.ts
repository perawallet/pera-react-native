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
    DuplicateAccountError,
    findAddressHolder,
    useAccountsStore,
    useImportAccount,
    useUpdateAccount,
    type HardwareWalletAccount,
    type LocalAccount,
    type LocalKeySeed,
    type MultiSigAccount,
    type WalletAccount,
    type WatchAccount,
    withMultisigParameters,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
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
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { backupAdapterFor, type BackupChainAdapter } from '../../chain-adapter'
import {
    BackupAccountType,
    isChainAddressPayload,
    isChainHdAddressPayload,
    isHdSeedSecretsPayload,
    type ChainAddressPayload,
    type ChainHdAddressPayload,
    type HardwareAddressPayload,
    type MultisigAddressPayload,
    type SecretsBackupPayload,
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
}

/** XHD root key (`kL || kR || chainCode`) length expected by `persistHDMasterKey`. */
const XHD_ROOT_LENGTH = 96

const toFailureReason = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

const nameField = (
    customName: string | null | undefined,
): { name: string } | Record<string, never> =>
    customName ? { name: customName } : {}

const assertValidAddress = (
    { adapter }: ImportContext,
    address: string,
): void => {
    if (!addressCodecs.get(adapter.chainId).isValid(address)) {
        throw new Error(`Invalid ${adapter.chainId} address: ${address}`)
    }
}

const buildHardwareAccount = (
    context: ImportContext,
    payload: HardwareAddressPayload,
): HardwareWalletAccount => {
    assertValidAddress(context, payload.address)
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
        chainId: context.adapter.chainId,
        chains: { [context.adapter.chainId]: { address: payload.address } },
        ...nameField(payload.customName),
    })
}

const buildWatchAccount = (
    context: ImportContext,
    payload: WatchAddressPayload,
): WatchAccount => {
    assertValidAddress(context, payload.address)
    return buildAccount({
        custody: { kind: 'watch' },
        chainId: context.adapter.chainId,
        chains: { [context.adapter.chainId]: { address: payload.address } },
        ...nameField(payload.customName),
    })
}

const buildMultisigAccount = (
    { adapter }: ImportContext,
    payload: MultisigAddressPayload,
): MultiSigAccount => {
    const multisig = multisigChainAdapters.get(adapter.chainId)
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
            chainId: adapter.chainId,
            chains: { [adapter.chainId]: { address: payload.address } },
            ...nameField(payload.customName),
        }),
        adapter.chainId,
        parameters,
    )
}

// Only a bip39 seed derives HD children.
type HdSeed = Extract<LocalKeySeed, 'bip39'>

const buildHdWalletAccount = async (
    { adapter }: ImportContext,
    seed: HdSeed,
    seedKeyId: string,
    payload: ChainHdAddressPayload,
): Promise<LocalAccount> => {
    // Derivation also commits the child key to the keystore, so no separate
    // `generateDerivedKey` call is needed here.
    const derived = await adapter.deriveHdAccount(kmsCore, seedKeyId, {
        account: payload.account,
        keyIndex: payload.keyIndex,
        derivationType: payload.derivationType,
    })
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
    secretsPayload: SecretsBackupPayload | null,
): Promise<WalletAccount[]> => {
    const { type } = addressPayload
    if (
        !secretsPayload ||
        isHdSeedSecretsPayload(secretsPayload) ||
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

    const hasSeedToImport = accounts.some(
        ({ secretsPayload }) =>
            !!secretsPayload && isHdSeedSecretsPayload(secretsPayload),
    )
    if (!hasSeedToImport) {
        return { seedKeyIdByFirstDerivedAddress, failures }
    }

    const heldSeedKeyIdByFirstDerivedAddress = await resolveHeldSeeds(context)

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
    context.appendAccount(
        await buildHdWalletAccount(context, seed, seedKeyId, payload),
    )
}

/**
 * Returns how many accounts the wallet gained — possibly several for one
 * recovery phrase, none for an hdSeed address entry. Throws `DuplicateAccountError` for an address the
 * wallet already holds, which the caller counts apart from a real failure.
 */
const importOneAccount = async (
    context: ImportContext,
    { address, addressPayload, secretsPayload }: PulledAccount,
    seedKeyIdByFirstDerivedAddress: Map<string, string>,
): Promise<number> => {
    const isDuplicate = !!findAddressHolder(
        useAccountsStore.getState().accounts,
        context.scope,
        address,
    )
    if (isDuplicate) {
        throw new DuplicateAccountError(address)
    }

    if (isChainAddressPayload(addressPayload)) {
        return importChainAccount(
            context,
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
            context.appendAccount(buildHardwareAccount(context, addressPayload))
            return 1
        }

        case BackupAccountType.watch: {
            context.appendAccount(buildWatchAccount(context, addressPayload))
            return 1
        }

        case BackupAccountType.multisig: {
            context.appendAccount(buildMultisigAccount(context, addressPayload))
            return 1
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
    addressPayload: ChainAddressPayload,
    secretsPayload: SecretsBackupPayload | null,
    seedKeyIdByFirstDerivedAddress: Map<string, string>,
): Promise<number> => {
    const local = context.adapter.localKindOf(addressPayload.type)
    if (!local) {
        throw new UnsupportedBackupAccountTypeError(
            addressPayload.type,
            context.adapter.chainId,
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

const importBatch = async (
    context: ImportContext,
    accounts: PulledAccount[],
    onProgress?: ImportProgressFn,
): Promise<ImportSummary> => {
    const total = accounts.length
    onProgress?.(0, total)
    const { seedKeyIdByFirstDerivedAddress, failures } = await importSeeds(
        context,
        accounts,
    )
    const summary: ImportSummary = {
        imported: 0,
        skippedDuplicate: 0,
        failed: [...failures],
    }

    for (const [index, account] of accounts.entries()) {
        try {
            summary.imported += await importOneAccount(
                context,
                account,
                seedKeyIdByFirstDerivedAddress,
            )
        } catch (error) {
            if (error instanceof DuplicateAccountError) {
                summary.skippedDuplicate += 1
            } else {
                const reason = toFailureReason(error)
                logger.warn('useCloudBackupImport: failed to import account', {
                    address: account.address,
                    reason,
                })
                summary.failed.push({ address: account.address, reason })
            }
        }
        onProgress?.(index + 1, total)
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
            appendAccount: newAccount =>
                setAccounts([
                    ...useAccountsStore.getState().accounts,
                    newAccount,
                ]),
        }),
        [
            scope,
            keys,
            hasSeedWithEntropy,
            persistHDMasterKey,
            importAccount,
            updateAccount,
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
