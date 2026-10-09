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
    DuplicateAccountError,
    findPathHolder,
    isSameAddress,
    useAccountsStore,
    useImportAccount,
    useUpdateAccount,
    type HDWalletAccount,
    type HardwareWalletAccount,
    type MultiSigAccount,
    type WalletAccount,
    type WatchAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
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
    hdPositionOf,
    payloadChain,
    type Algo25AddressPayload,
    type HardwareAddressPayload,
    type HdChainAddressPayload,
    type HdWalletAddressPayload,
    type MultisigAddressPayload,
    type QuantumAddressPayload,
    type SecretsBackupPayload,
    type StandaloneKeyAddressPayload,
    type WatchAddressPayload,
    type WatchChainAddressPayload,
} from '../models'
import type { PulledAccount } from '../restore/pullBackupItems'
import type {
    ImportProgressFn,
    ImportSummary,
    SyncImportFn,
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
    importAccount: ReturnType<typeof useImportAccount>
    updateAccount: ReturnType<typeof useUpdateAccount>
    appendAccount: (account: WalletAccount) => void
    replaceAccount: (account: WalletAccount) => void
}

/** XHD root key (`kL || kR || chainCode`) length expected by `persistHDMasterKey`. */
const XHD_ROOT_LENGTH = 96

const toFailureReason = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

const nameField = (
    customName: string | null | undefined,
): { name: string } | Record<string, never> =>
    customName ? { name: customName } : {}

const assertValidAddress = (chainId: ChainId, address: string): void => {
    if (!addressCodecs.get(chainId).isValid(address)) {
        throw new Error(`Invalid ${chainId} address: ${address}`)
    }
}

const buildHardwareAccount = (
    context: ImportContext,
    payload: HardwareAddressPayload,
): HardwareWalletAccount => {
    assertValidAddress(context.adapter.chainId, payload.address)
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
    assertValidAddress(context.adapter.chainId, payload.address)
    return buildAccount({
        custody: { kind: 'watch' },
        chainId: context.adapter.chainId,
        chains: { [context.adapter.chainId]: { address: payload.address } },
        ...nameField(payload.customName),
    })
}

const buildWatchChainAccount = (
    payload: WatchChainAddressPayload,
): WatchAccount => {
    assertValidAddress(payload.chain, payload.address)
    return buildAccount({
        custody: { kind: 'watch' },
        chainId: payload.chain,
        chains: { [payload.chain]: { address: payload.address } },
        ...nameField(payload.customName),
    })
}

const buildMultisigAccount = (
    { adapter }: ImportContext,
    payload: MultisigAddressPayload,
): MultiSigAccount => {
    const derived = multisigChainAdapters.get(adapter.chainId).deriveAddress({
        version: payload.version,
        threshold: payload.threshold,
        addresses: payload.participantAddresses,
    })
    if (derived !== payload.address) {
        throw new Error(
            `Multisig address mismatch: derived ${derived} != backup ${payload.address}`,
        )
    }
    return buildAccount({
        custody: { kind: 'multisig' },
        chainId: adapter.chainId,
        chains: {
            [adapter.chainId]: {
                address: payload.address,
                native: {
                    family: 'algorand',
                    multisig: {
                        version: payload.version,
                        threshold: payload.threshold,
                        addresses: payload.participantAddresses,
                    },
                },
            },
        },
        ...nameField(payload.customName),
    })
}

const buildHdWalletAccount = async (
    { adapter }: ImportContext,
    seedKeyId: string,
    payload: HdWalletAddressPayload,
): Promise<HDWalletAccount> => {
    const hdWalletDetails: HDWalletAccount['hdWalletDetails'] = {
        account: payload.account,
        change: payload.change,
        keyIndex: payload.keyIndex,
        derivationType:
            payload.derivationType as HDWalletAccount['hdWalletDetails']['derivationType'],
    }
    // Derivation also commits the child key to the keystore, so no separate
    // `generateDerivedKey` call is needed here.
    const derived = await adapter.deriveHdAccount(
        kmsCore,
        seedKeyId,
        hdWalletDetails,
    )
    if (derived.address !== payload.address) {
        throw new Error(
            `hdWallet address mismatch: derived ${derived.address} != backup ${payload.address}`,
        )
    }
    return buildAccount({
        custody: {
            kind: 'local',
            seed: 'bip39',
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
 * custody stays in one place, and because quantum needs that path's
 * dual-derivation on-chain probe. Returns the accounts the wallet gained —
 * two for quantum (canonical + legacy derivation).
 */
const importFromMnemonic = async (
    { importAccount, updateAccount }: ImportContext,
    addressPayload: Algo25AddressPayload | QuantumAddressPayload,
    secretsPayload: SecretsBackupPayload | null,
): Promise<WalletAccount[]> => {
    const { type } = addressPayload
    if (!secretsPayload || secretsPayload.type !== type) {
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
        result = await importAccount({
            mnemonicIndices,
            type: type === BackupAccountType.quantum ? 'quantum' : 'standalone',
        })
    } finally {
        zeroBytes(mnemonicIndices)
    }
    const returned = Array.isArray(result) ? result : [result]
    // `hdWallet` is the only import type that resolves to a pending handle
    // instead of accounts, and it never reaches this path.
    if (returned.some(account => !('address' in account))) {
        throw new Error(`Unexpected non-account result for ${type} import`)
    }
    const imported = returned as WalletAccount[]
    if (addressPayload.customName) {
        const match = imported.find(
            account => account.address === addressPayload.address,
        )
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
        // Only bip39 roots — algo25/quantum seeds have no entropy child and
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
 * Runs before the main loop so hdWallet children can derive against their
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

    // A held seed is resolved for any item that derives from one, not only when
    // the batch carries the seed itself: a lone child arriving by sync, or a
    // restore onto a device that already holds the wallet, derives against it.
    const needsSeeds = accounts.some(
        account =>
            account.secretsPayload?.type === BackupAccountType.hdSeed ||
            hdPositionOf(account.addressPayload) !== null,
    )
    if (!needsSeeds) {
        return { seedKeyIdByFirstDerivedAddress, failures }
    }

    const heldSeedKeyIdByFirstDerivedAddress = await resolveHeldSeeds(context)
    for (const [reference, seedKeyId] of heldSeedKeyIdByFirstDerivedAddress) {
        seedKeyIdByFirstDerivedAddress.set(reference, seedKeyId)
    }

    for (const { address, secretsPayload } of accounts) {
        if (secretsPayload?.type !== BackupAccountType.hdSeed) continue
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
    payload: HdWalletAddressPayload,
    seedKeyIdByFirstDerivedAddress: Map<string, string>,
): Promise<void> => {
    const seedKeyId = seedKeyIdByFirstDerivedAddress.get(
        payload.seedFirstDerivedAddress,
    )
    if (!seedKeyId) {
        throw new Error(
            `No parent seed for hdWallet (seedFirstDerivedAddress=${payload.seedFirstDerivedAddress})`,
        )
    }
    const account = await buildHdWalletAccount(context, seedKeyId, payload)
    const { chainId } = context.adapter
    const holder = findPathHolder(
        useAccountsStore.getState().accounts as WalletAccount[],
        seedKeyId,
        { account: payload.account, keyIndex: payload.keyIndex },
    )
    // The account at this position may already exist from another chain's
    // item, and a second one would split a single wallet account in two.
    if (!holder || chainAccountOf(holder, chainId)) {
        context.appendAccount(account)
        return
    }
    const entry = account.chains?.[chainId]
    context.replaceAccount({
        ...holder,
        chains: { ...holder.chains, [chainId]: entry },
    } as WalletAccount)
}

/** Returns 1 when the call created the account, 0 when it added this chain's
 *  entry to the account already at that position. */
const importHdChainAccount = async (
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
    const account = await store.addChainAccount(
        seedKeyId,
        payload.chain,
        { account: payload.account, keyIndex: payload.keyIndex },
        payload.customName || undefined,
    )
    const derived = chainAccountOf(account, payload.chain)?.address
    if (
        derived === undefined ||
        !isSameAddress(payload.chain, derived, payload.address)
    ) {
        throw new Error(
            `hdChain address mismatch: derived ${derived} != backup ${payload.address}`,
        )
    }
    return useAccountsStore.getState().accounts.length > before ? 1 : 0
}

/** The key is hex only until it is decoded here, and the bytes are zeroed
 *  whether or not the import succeeds. */
const importStandaloneKeyAccount = async (
    payload: StandaloneKeyAddressPayload,
    secretsPayload: SecretsBackupPayload | null,
): Promise<void> => {
    if (
        secretsPayload?.type !== BackupAccountType.standaloneKey ||
        secretsPayload.chain !== payload.chain
    ) {
        throw new Error('standaloneKey account missing private key secret')
    }
    const privateKey = hexToBytes(secretsPayload.privateKey)
    let imported: WalletAccount
    try {
        imported = await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(
                payload.chain,
                privateKey,
                payload.customName || undefined,
            )
    } finally {
        zeroBytes(privateKey)
    }
    const derived = chainAccountOf(imported, payload.chain)?.address
    if (
        derived === undefined ||
        !isSameAddress(payload.chain, derived, payload.address)
    ) {
        throw new Error(
            `standaloneKey address mismatch: derived ${derived} != backup ${payload.address}`,
        )
    }
}

/**
 * Returns how many accounts the wallet gained — two for quantum, none for an
 * hdSeed address entry. Throws `DuplicateAccountError` for an address the
 * wallet already holds, which the caller counts apart from a real failure.
 */
const importOneAccount = async (
    context: ImportContext,
    { address, addressPayload, secretsPayload }: PulledAccount,
    seedKeyIdByFirstDerivedAddress: Map<string, string>,
): Promise<number> => {
    const chainId = payloadChain(addressPayload) ?? context.adapter.chainId
    const isDuplicate = (
        useAccountsStore.getState().accounts as WalletAccount[]
    ).some(account => {
        const held = chainAccountOf(account, chainId)?.address
        return held !== undefined && isSameAddress(chainId, held, address)
    })
    if (isDuplicate) {
        throw new DuplicateAccountError(address)
    }

    switch (addressPayload.type) {
        case BackupAccountType.algo25:
        case BackupAccountType.quantum: {
            const imported = await importFromMnemonic(
                context,
                addressPayload,
                secretsPayload,
            )
            return imported.length
        }

        case BackupAccountType.hdSeed: {
            // Seeds are persisted in the pre-pass (the secret rides on
            // secrets/<firstDerivedAddress>). A standalone hdSeed address entry
            // only appears when its first account was removed — nothing to
            // create.
            return 0
        }

        case BackupAccountType.hdWallet: {
            await importHdWalletAccount(
                context,
                addressPayload,
                seedKeyIdByFirstDerivedAddress,
            )
            return 1
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

        case BackupAccountType.hdChain: {
            return importHdChainAccount(
                addressPayload,
                seedKeyIdByFirstDerivedAddress,
            )
        }

        case BackupAccountType.standaloneKey: {
            await importStandaloneKeyAccount(addressPayload, secretsPayload)
            return 1
        }

        case BackupAccountType.watchChain: {
            context.appendAccount(buildWatchChainAccount(addressPayload))
            return 1
        }

        default: {
            const exhaustive: never = addressPayload
            throw new Error(
                `Unsupported backup account type: ${String(
                    (exhaustive as { type?: string }).type,
                )}`,
            )
        }
    }
}

/**
 * One account can fail twice — a corrupt seed in the pre-pass, then its
 * hdWallet child with "no parent seed". Keeps the first, which is more specific.
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

/** Each stage needs the one before it: an `hdChain` entry extends the account an
 *  `hdWallet` item creates, so it runs after every legacy kind. */
const importStageOf = ({ addressPayload }: PulledAccount): number => {
    switch (addressPayload.type) {
        case BackupAccountType.hdChain: {
            return 1
        }
        case BackupAccountType.standaloneKey: {
            return 2
        }
        case BackupAccountType.watchChain: {
            return 3
        }
        default: {
            return 0
        }
    }
}

const importBatch = async (
    context: ImportContext,
    pulled: PulledAccount[],
    onProgress?: ImportProgressFn,
): Promise<ImportSummary> => {
    const accounts = [...pulled].sort(
        (a, b) => importStageOf(a) - importStageOf(b),
    )
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

const useImportContext = (): Omit<ImportContext, 'adapter'> => {
    const importAccount = useImportAccount()
    const updateAccount = useUpdateAccount()
    const { keys, hasSeedWithEntropy, persistHDMasterKey } = useKMS()
    // Reading the hook-subscribed snapshot would close over a single render's
    // account list, so back-to-back appends in the loop would clobber each
    // other. We always read+write the live store instead.
    const setAccounts = useAccountsStore(state => state.setAccounts)

    return useMemo(
        () => ({
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
            keys,
            hasSeedWithEntropy,
            persistHDMasterKey,
            importAccount,
            updateAccount,
            setAccounts,
        ],
    )
}

export const useCloudBackupImport = (): UseCloudBackupImportResult => {
    const context = useImportContext()

    // Resolved before the seed pre-pass so a build without the chain's adapter
    // refuses the whole restore instead of half-importing it.
    const importAccounts = useCallback(
        async (accounts: PulledAccount[], onProgress?: ImportProgressFn) =>
            importBatch(
                { ...context, adapter: backupAdapterFor() },
                accounts,
                onProgress,
            ),
        [context],
    )

    return { importAccounts }
}
