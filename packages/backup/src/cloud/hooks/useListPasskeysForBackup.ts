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

import { useCallback } from 'react'
import {
    BACKUP_ACCESS_DOMAIN,
    canAccess,
    entropyChildIdOf,
    withSecret,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import {
    createPasskeyPrivateKeyReader,
    isPasskeyKey,
    passkeyBackupInputs,
    readFlatKeystoreRecords,
    storedPasskeyBackupInputs,
    type PasskeyBackupInputs,
    type PasskeyPrivateKeyReader,
} from '@perawallet/wallet-core-passkeys'
import { logger } from '@perawallet/wallet-core-shared'
import {
    getKeystoreStore,
    keystoreSubtle,
} from '@perawallet/wallet-extension-provider'
import { backupSeedReference } from '../../chain-adapter'
import { useProvenPasskeysStore } from '../store/provenPasskeysStore'
import type { BackupPasskey, LocalPasskey } from '../sync/types'

/** Resolves a seed key id's entropy directly. `SeedEntropyResolver` keys by
 *  seed address because that is all a restored payload carries;
 *  `passkeyBackupInputs` already knows the owning seed's key id from the
 *  credential's own metadata. */
const readSeedEntropy = async (
    seedKeyId: string,
): Promise<Uint8Array | null> => {
    const keys = getKeystoreStore().state.keys
    const seedKey = keys.find(key => key.id === seedKeyId)
    // Gated like the HD seed read, so a seed that denies the backup domain
    // keeps its credentials out of the backup instead of being read around.
    if (!seedKey || !canAccess(seedKey, BACKUP_ACCESS_DOMAIN)) return null
    const entropyId = entropyChildIdOf(seedKeyId, keys)
    if (!entropyId) return null
    // `withSecret` zeroes its buffer once the handler returns, so the handler
    // copies the bytes out rather than handing back the reference itself.
    return withSecret(entropyId, entropy => new Uint8Array(entropy))
}

type SweepCaches = {
    resolveEntropy: (seedKeyId: string) => Promise<Uint8Array | null>
    mainKeys: Map<string, Promise<Uint8Array | null>>
    dispose: () => Promise<void>
}

/**
 * Per-sweep caches keyed by owning seed. A user's credentials cluster on one
 * wallet, so without these each one pays its own secret read and its own
 * 210,000-iteration PBKDF2. They hold promises rather than values because the
 * sweep runs its credentials concurrently, and both hold copies of secret
 * material that outlive the call that made them — `dispose` is what zeroes
 * those copies.
 */
const createSweepCaches = (): SweepCaches => {
    const entropies = new Map<string, Promise<Uint8Array | null>>()
    const mainKeys = new Map<string, Promise<Uint8Array | null>>()

    const zeroAll = async (cache: Map<string, Promise<Uint8Array | null>>) => {
        for (const pending of cache.values()) {
            const secret = await pending.catch(() => null)
            if (secret) zeroBytes(secret)
        }
        cache.clear()
    }

    return {
        resolveEntropy: seedKeyId => {
            if (!entropies.has(seedKeyId)) {
                entropies.set(seedKeyId, readSeedEntropy(seedKeyId))
            }
            return entropies.get(seedKeyId)!
        },
        mainKeys,
        dispose: async () => {
            await zeroAll(mainKeys)
            await zeroAll(entropies)
        },
    }
}

type KeystoreKey = ReturnType<typeof getKeystoreStore>['state']['keys'][number]

/**
 * Every key a credential could be hiding in. Android credentials live in the
 * keystore's `k/`+`m/` split, which the reactive store holds; iOS credentials
 * are flat bare-id records only `readFlatKeystoreRecords` sees, and so is an
 * Android credential the per-launch split has not moved yet.
 *
 * Deduped by id, store first: it is already decrypted.
 */
const collectCandidateKeys = async (): Promise<KeystoreKey[]> => {
    const storeKeys = getKeystoreStore().state.keys
    const seen = new Set(storeKeys.map(key => key.id))

    let flat
    try {
        flat = await readFlatKeystoreRecords({
            subtle: keystoreSubtle,
        })
    } catch (error) {
        // Never fail the sweep over the flat scan: the store's own keys are
        // still worth proving, and a keychain that will not open is a device
        // condition.
        logger.warn('useListPasskeysForBackup: flat record scan failed', {
            error: error instanceof Error ? error.message : String(error),
        })
        return [...storeKeys]
    }

    if (!flat.isComplete) {
        logger.warn('useListPasskeysForBackup: flat record scan was incomplete')
    }

    return [
        ...storeKeys,
        ...(flat.keys as KeystoreKey[]).filter(key => !seen.has(key.id)),
    ]
}

/** The record's own key wins because it needs no seed. Re-deriving covers a
 *  biometric-wrapped Android key or an engine record without material. */
const resolveBackupInputs = async (
    key: KeystoreKey,
    readPrivateKey: PasskeyPrivateKeyReader,
    caches: SweepCaches,
): Promise<PasskeyBackupInputs | null> => {
    if (!isPasskeyKey(key)) return null
    const stored = await readPrivateKey(key.id)
    const fromRecord =
        stored === null ? null : storedPasskeyBackupInputs(key, stored)
    return (
        fromRecord ??
        passkeyBackupInputs(
            key,
            caches.resolveEntropy,
            undefined,
            caches.mainKeys,
        )
    )
}

const zeroPrivateKeys = (passkeys: readonly { privateKey: Uint8Array }[]) => {
    for (const passkey of passkeys) zeroBytes(passkey.privateKey)
}

const sweepPasskeys = async (): Promise<LocalPasskey[]> => {
    const keys = await collectCandidateKeys()

    const caches = createSweepCaches()
    const readPrivateKey = createPasskeyPrivateKeyReader({
        subtle: keystoreSubtle,
    })
    let settled: PromiseSettledResult<PasskeyBackupInputs | null>[]
    try {
        // Settled rather than `Promise.all`: one credential's failure must not
        // abandon the keys every other credential has already produced.
        settled = await Promise.allSettled(
            keys.map(key => resolveBackupInputs(key, readPrivateKey, caches)),
        )
    } finally {
        await Promise.all([caches.dispose(), readPrivateKey.dispose()])
    }

    const resolved = settled.flatMap(result =>
        result.status === 'fulfilled' && result.value !== null
            ? [result.value]
            : [],
    )
    const failure = settled.find(result => result.status === 'rejected')
    if (failure) {
        zeroPrivateKeys(resolved)
        throw failure.reason
    }

    const passkeys: LocalPasskey[] = []
    try {
        for (const { seedKeyId, ...rest } of resolved) {
            // The same dedup key `useResolveHdSeedForBackup` derives, joining
            // to the seed's own `secrets/` backup item.
            const seedAddress =
                seedKeyId === undefined
                    ? undefined
                    : await backupSeedReference(seedKeyId)
            passkeys.push({ ...rest, seedAddress })
        }
    } catch (error) {
        zeroPrivateKeys(resolved)
        throw error
    }
    return passkeys
}

const withoutPrivateKey = ({
    privateKey: _privateKey,
    ...passkey
}: LocalPasskey): BackupPasskey => passkey

export const useListPasskeysForBackup = (): (() => Promise<LocalPasskey[]>) => {
    const setProvenPasskeys = useProvenPasskeysStore(
        state => state.setProvenPasskeys,
    )

    return useCallback(async () => {
        const passkeys = await sweepPasskeys()
        // Re-deriving costs a PBKDF2 per owning seed, so the metadata is cached
        // for the review screens and overview counts to read synchronously
        // instead of re-running the sweep on a render path. Never the keys.
        setProvenPasskeys(passkeys.map(withoutPrivateKey))
        return passkeys
    }, [setProvenPasskeys])
}

/** For callers that only show which credentials can be backed up. Proving one
 *  still reads its key, but every key is zeroed before this resolves, so none
 *  outlives the sweep. */
export const useListPasskeyMetadataForBackup = (): (() => Promise<
    BackupPasskey[]
>) => {
    const setProvenPasskeys = useProvenPasskeysStore(
        state => state.setProvenPasskeys,
    )

    return useCallback(async () => {
        const passkeys = await sweepPasskeys()
        let metadata: BackupPasskey[]
        try {
            metadata = passkeys.map(withoutPrivateKey)
        } finally {
            zeroPrivateKeys(passkeys)
        }
        setProvenPasskeys(metadata)
        return metadata
    }, [setProvenPasskeys])
}
