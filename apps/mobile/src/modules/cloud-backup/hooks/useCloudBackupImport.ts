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
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import {
    AccountTypes,
    DuplicateAccountError,
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
    BackupAccountType,
    type Algo25AddressPayload,
    type HardwareAddressPayload,
    type HdWalletAddressPayload,
    type ImportSummary,
    type MultisigAddressPayload,
    type PulledAccount,
    type QuantumAddressPayload,
    type SecretsBackupPayload,
    type SyncImportFn,
    type WatchAddressPayload,
} from '@perawallet/wallet-core-backup'
import {
    encodeAlgorandAddress,
    generateMultisigAddress,
    isValidAlgorandAddress,
} from '@perawallet/wallet-core-blockchain'
import { hdDerivedKeyId, hexToBytes, useKMS } from '@perawallet/wallet-core-kms'
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'

type ImportFailure = ImportSummary['failed'][number]

export type UseCloudBackupImportResult = {
    importAccounts: SyncImportFn
}

type ImportContext = Pick<
    ReturnType<typeof useKMS>,
    'keys' | 'hasSeedWithEntropy' | 'persistHDMasterKey' | 'getDerivedPublicKey'
> & {
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

const assertValidAddress = (address: string): void => {
    if (!isValidAlgorandAddress(address)) {
        throw new Error(`Invalid Algorand address: ${address}`)
    }
}

const buildHardwareAccount = (
    payload: HardwareAddressPayload,
): HardwareWalletAccount => {
    assertValidAddress(payload.address)
    return {
        id: generateOrderedUniqueId(),
        address: payload.address,
        type: AccountTypes.hardware,
        hardwareDetails: {
            manufacturer: payload.manufacturer,
            deviceId: payload.deviceId,
            deviceName: payload.deviceName,
            accountIndex: payload.accountIndex,
            transportType: payload.transportType,
        },
        ...nameField(payload.customName),
    }
}

const buildWatchAccount = (payload: WatchAddressPayload): WatchAccount => {
    assertValidAddress(payload.address)
    return {
        id: generateOrderedUniqueId(),
        address: payload.address,
        type: AccountTypes.watch,
        ...nameField(payload.customName),
    }
}

const buildMultisigAccount = (
    payload: MultisigAddressPayload,
): MultiSigAccount => {
    const derived = generateMultisigAddress(
        payload.version,
        payload.threshold,
        payload.participantAddresses,
    )
    if (derived !== payload.address) {
        throw new Error(
            `Multisig address mismatch: derived ${derived} != backup ${payload.address}`,
        )
    }
    return {
        id: generateOrderedUniqueId(),
        address: payload.address,
        type: AccountTypes.multisig,
        multisigDetails: {
            threshold: payload.threshold,
            addresses: payload.participantAddresses,
            version: payload.version,
        },
        ...nameField(payload.customName),
    }
}

const buildHdWalletAccount = async (
    { getDerivedPublicKey }: ImportContext,
    seedKeyId: string,
    payload: HdWalletAddressPayload,
): Promise<HDWalletAccount> => {
    const derivationType = payload.derivationType as BIP32DerivationType
    const publicKey = await getDerivedPublicKey(
        seedKeyId,
        payload.account,
        payload.keyIndex,
        derivationType,
    )
    const derivedAddress = encodeAlgorandAddress(publicKey)
    if (derivedAddress !== payload.address) {
        throw new Error(
            `hdWallet address mismatch: derived ${derivedAddress} != backup ${payload.address}`,
        )
    }
    // `getDerivedPublicKey` above already commits the child key to the keystore
    // (under the deterministic `hdDerivedKeyId`) as a side effect, so no
    // separate `generateDerivedKey` call is needed here.
    return {
        id: generateOrderedUniqueId(),
        address: payload.address,
        type: AccountTypes.hdWallet,
        hdWalletDetails: {
            account: payload.account,
            change: payload.change,
            keyIndex: payload.keyIndex,
            derivationType:
                payload.derivationType as HDWalletAccount['hdWalletDetails']['derivationType'],
        },
        keyPairId: hdDerivedKeyId(
            seedKeyId,
            payload.account,
            payload.keyIndex,
            derivationType,
        ),
        ...nameField(payload.customName),
    }
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
    const result = await importAccount({
        mnemonic: secretsPayload.mnemonic,
        type,
    })
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
    { persistHDMasterKey, getDerivedPublicKey }: ImportContext,
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

    const firstDerivedPublicKey = await getDerivedPublicKey(
        seedKeyId,
        0,
        0,
        BIP32DerivationType.Peikert,
    )
    return {
        seedKeyId,
        firstDerivedAddress: encodeAlgorandAddress(firstDerivedPublicKey),
    }
}

/**
 * Restoring onto a wallet that already holds a seed must reuse it:
 * `persistHDMasterKey` mints a fresh id and entropy child every call, so an
 * unguarded re-restore orphans a second copy of the user's HD root.
 */
const resolveHeldSeeds = async ({
    keys,
    hasSeedWithEntropy,
    getDerivedPublicKey,
}: ImportContext): Promise<Map<string, string>> => {
    const held = new Map<string, string>()
    for (const seedKeyId of keys.keys()) {
        // Only bip39 roots — algo25/quantum seeds have no entropy child and
        // nothing to derive an address path against.
        if (!hasSeedWithEntropy(seedKeyId)) continue
        try {
            const firstDerivedPublicKey = await getDerivedPublicKey(
                seedKeyId,
                0,
                0,
                BIP32DerivationType.Peikert,
            )
            held.set(encodeAlgorandAddress(firstDerivedPublicKey), seedKeyId)
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

    const hasSeedToImport = accounts.some(
        account => account.secretsPayload?.type === BackupAccountType.hdSeed,
    )
    if (!hasSeedToImport) {
        return { seedKeyIdByFirstDerivedAddress, failures }
    }

    const heldSeedKeyIdByFirstDerivedAddress = await resolveHeldSeeds(context)

    for (const { address, secretsPayload } of accounts) {
        if (secretsPayload?.type !== BackupAccountType.hdSeed) continue
        try {
            // `address` is the seed secret's key suffix, which the serializer
            // always sets to the first-derived address.
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
    context.appendAccount(
        await buildHdWalletAccount(context, seedKeyId, payload),
    )
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
    const isDuplicate = useAccountsStore
        .getState()
        .accounts.some(account => account.address === address)
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
            context.appendAccount(buildHardwareAccount(addressPayload))
            return 1
        }

        case BackupAccountType.watch: {
            context.appendAccount(buildWatchAccount(addressPayload))
            return 1
        }

        case BackupAccountType.multisig: {
            context.appendAccount(buildMultisigAccount(addressPayload))
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

const importBatch = async (
    context: ImportContext,
    accounts: PulledAccount[],
): Promise<ImportSummary> => {
    const { seedKeyIdByFirstDerivedAddress, failures } = await importSeeds(
        context,
        accounts,
    )
    const summary: ImportSummary = {
        imported: 0,
        skippedDuplicate: 0,
        failed: [...failures],
    }

    for (const account of accounts) {
        try {
            summary.imported += await importOneAccount(
                context,
                account,
                seedKeyIdByFirstDerivedAddress,
            )
        } catch (error) {
            if (error instanceof DuplicateAccountError) {
                summary.skippedDuplicate += 1
                continue
            }
            const reason = toFailureReason(error)
            logger.warn('useCloudBackupImport: failed to import account', {
                address: account.address,
                reason,
            })
            summary.failed.push({ address: account.address, reason })
        }
    }

    summary.failed = dedupeFailuresByAddress(summary.failed)
    return summary
}

const useImportContext = (): ImportContext => {
    const importAccount = useImportAccount()
    const updateAccount = useUpdateAccount()
    const {
        keys,
        hasSeedWithEntropy,
        persistHDMasterKey,
        getDerivedPublicKey,
    } = useKMS()
    // Reading the hook-subscribed snapshot would close over a single render's
    // account list, so back-to-back appends in the loop would clobber each
    // other. We always read+write the live store instead.
    const setAccounts = useAccountsStore(state => state.setAccounts)

    return useMemo(
        () => ({
            keys,
            hasSeedWithEntropy,
            persistHDMasterKey,
            getDerivedPublicKey,
            importAccount,
            updateAccount,
            appendAccount: newAccount =>
                setAccounts([
                    ...useAccountsStore.getState().accounts,
                    newAccount,
                ]),
        }),
        [
            keys,
            hasSeedWithEntropy,
            persistHDMasterKey,
            getDerivedPublicKey,
            importAccount,
            updateAccount,
            setAccounts,
        ],
    )
}

export const useCloudBackupImport = (): UseCloudBackupImportResult => {
    const context = useImportContext()

    const importAccounts = useCallback(
        (accounts: PulledAccount[]) => importBatch(context, accounts),
        [context],
    )

    return { importAccounts }
}
