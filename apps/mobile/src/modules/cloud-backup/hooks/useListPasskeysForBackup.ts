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
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    type BackupPasskey,
    useProvenPasskeysStore,
} from '@perawallet/wallet-core-backup'
import {
    BACKUP_ACCESS_DOMAIN,
    canAccess,
    entropyChildIdOf,
    useKMS,
    withSecret,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import {
    passkeyBackupInputs,
    readFlatKeystoreRecords,
} from '@perawallet/wallet-core-passkeys'
import { logger } from '@perawallet/wallet-core-shared'
import { subtle } from 'react-native-quick-crypto'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'

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
            subtle: subtle as unknown as SubtleCrypto,
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

export const useListPasskeysForBackup = (): (() => Promise<
    BackupPasskey[]
>) => {
    const { getDerivedPublicKey } = useKMS()
    const setProvenPasskeys = useProvenPasskeysStore(
        state => state.setProvenPasskeys,
    )

    return useCallback(async () => {
        const keys = await collectCandidateKeys()

        const caches = createSweepCaches()
        let inputs
        try {
            inputs = await Promise.all(
                keys.map(key =>
                    passkeyBackupInputs(
                        key,
                        caches.resolveEntropy,
                        undefined,
                        caches.mainKeys,
                    ),
                ),
            )
        } finally {
            await caches.dispose()
        }

        const passkeys: BackupPasskey[] = []
        for (const input of inputs) {
            if (input === null) continue
            const { seedKeyId, ...rest } = input
            // First-derived (acc0/idx0/Peikert) address, the same dedup key
            // `useResolveHdSeedForBackup` derives, joining to the seed's own
            // `secrets/` backup item.
            const firstDerived = await getDerivedPublicKey(
                seedKeyId,
                0,
                0,
                BIP32DerivationType.Peikert,
            )
            passkeys.push({
                ...rest,
                seedAddress: encodeAlgorandAddress(firstDerived),
            })
        }

        // Proving the credentials costs a PBKDF2 per owning seed, so this
        // result is cached for the review screens and overview counts to read
        // synchronously instead of re-deriving on a render path.
        setProvenPasskeys(passkeys)
        return passkeys
    }, [getDerivedPublicKey, setProvenPasskeys])
}
