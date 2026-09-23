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
    entropyChildIdOf,
    useKMS,
    withSecret,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import { passkeyBackupInputs } from '@perawallet/wallet-core-passkeys'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'

/** Resolves a seed key id's entropy directly. `SeedEntropyResolver` keys by
 *  seed address because that is all a restored payload carries;
 *  `passkeyBackupInputs` already knows the owning seed's key id from the
 *  credential's own metadata. */
const readSeedEntropy = async (
    seedKeyId: string,
): Promise<Uint8Array | null> => {
    const keys = getKeystoreStore().state.keys
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

export const useListPasskeysForBackup = (): (() => Promise<
    BackupPasskey[]
>) => {
    const { getDerivedPublicKey } = useKMS()
    const setProvenPasskeys = useProvenPasskeysStore(
        state => state.setProvenPasskeys,
    )

    return useCallback(async () => {
        const keys = getKeystoreStore().state.keys

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
