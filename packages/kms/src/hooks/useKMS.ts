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
import type { Key } from '@algorandfoundation/keystore-core'
import type { PQSchemeId } from '@perawallet/wallet-core-blockchain'
import {
    InvalidKeyError,
    KeyManagementError,
    KeyNotFoundError,
} from '../errors'
import { zeroBytes } from '../crypto/secure-memory'
import {
    entropyChildIdOf,
    expiresAtOf,
    isSeedKey,
    seedSchemeOf,
} from '../utils'
import { SeedScheme } from '../constants'
import { FALCON_CHILD_KEY_TYPE } from '../models/keys'
import { useAlgo25 } from './useAlgo25'
export type { Algo25KeyResult } from './useAlgo25'
import { useQuantum } from './useQuantum'
export type { QuantumKeyResult } from './useQuantum'
import { useHDWallet } from './useHDWallet'
export type { HDWalletKeyResult } from './useHDWallet'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { useKMSService } from './useKMSServices'
import { useKeystoreKeys } from './useKeystoreState'
import { entropyToIndices } from '../crypto/hdwallet-utils'
import { algo25SeedToIndices } from '../crypto/algo25-utils'
import { withSecret } from '../storage/secrets'
import { getPQProvider } from '../crypto/pq'

export type ExecuteWithMnemonicHandler<T> = (
    indices: Uint16Array,
) => T | Promise<T>

export const useKMS = () => {
    const keystoreKeys = useKeystoreKeys()
    const { createAlgo25Key } = useAlgo25()
    const { createQuantumKey } = useQuantum()
    const {
        createHDWalletKey,
        persistHDMasterKey,
        generateDerivedKey,
        getDerivedPublicKey,
    } = useHDWallet()
    const { deleteKey, keyStore, withExportedKey, checkAccess } =
        useKMSService()

    // All seed keys mapped by id for quick lookup. No private data is exposed here
    const seeds = useMemo(() => {
        const out = new Map<string, Key>()
        for (const k of keystoreKeys) {
            if (isSeedKey(k)) out.set(k.id, k)
        }
        return out
    }, [keystoreKeys])

    // A map of child key id to parent seed id, derived from the reactive keystore. No private data is exposed here.
    const childToParent = useMemo(() => {
        const m = new Map<string, string>()
        for (const k of keystoreKeys) {
            const parentKeyId = (k.metadata as Record<string, unknown>)
                ?.parentKeyId
            if (typeof parentKeyId === 'string') m.set(k.id, parentKeyId)
        }
        return m
    }, [keystoreKeys])

    /**
     * Resolves a child keystore id to its parent seed id
     */
    const seedIdOf = useCallback(
        (childId: string | undefined): string | undefined => {
            if (!childId) return undefined
            const cached = childToParent.get(childId)
            if (cached !== undefined) return cached
            const live = getKeystoreStore().state.keys.find(
                k => k.id === childId,
            )
            const parentKeyId = (
                live?.metadata as Record<string, unknown> | undefined
            )?.parentKeyId
            return typeof parentKeyId === 'string' ? parentKeyId : undefined
        },
        [childToParent],
    )

    /**
     * Removes a top-level key (typically a seed) and every keystore entry
     * whose `metadata.parentKeyId` points back to it.
     */
    const removeKeyAndChildren = useCallback(
        async (rootKeyId: string): Promise<void> => {
            const liveKeys = getKeystoreStore().state.keys
            for (const k of liveKeys) {
                if (k.id === rootKeyId) continue
                const parentKeyId = (k.metadata as Record<string, unknown>)
                    ?.parentKeyId
                if (parentKeyId === rootKeyId) {
                    await keyStore.remove(k.id)
                }
            }
            await keyStore.remove(rootKeyId)
        },
        [keyStore],
    )

    const getKey = useCallback(
        (keyId: string): Key | null => {
            const key = keystoreKeys.find(k => k.id === keyId) ?? null
            if (!key) return null
            // Expiry is stamped on the seed (the wallet-domain root). If
            // the caller is asking about a child, walk up before checking.
            const seedKey = isSeedKey(key)
                ? key
                : (keystoreKeys.find(k => k.id === seedIdOf(keyId)) ?? null)
            if (seedKey) {
                const expiresAt = expiresAtOf(seedKey)
                if (expiresAt && Date.now() > expiresAt.getTime()) {
                    void keyStore.remove(seedKey.id)
                    return null
                }
            }
            return key
        },
        [keystoreKeys, keyStore, seedIdOf],
    )

    const getKeyOrThrow = useCallback(
        (keyId: string): Key => {
            const key = getKey(keyId)
            if (!key) {
                throw new KeyNotFoundError(keyId)
            }
            return key
        },
        [getKey],
    )

    /**
     * Signs each payload with the real Falcon-1024 PQ signer. The quantum
     * child entry holds no private material — the keypair is re-derived from
     * the parent seed's private bytes, exported only for the duration of
     * this call. Both the seed bytes and the derived secret key are zeroed
     * in `finally` once signing completes.
     */
    const signWithQuantumSeed = (
        seedKey: Key,
        payloads: Uint8Array[],
    ): Promise<Uint8Array[]> =>
        withExportedKey(seedKey.id, seedData => {
            if (!seedData.privateKey) {
                throw new KeyManagementError(
                    'Quantum seed has no private key bytes',
                )
            }
            const seedBytes = new Uint8Array(seedData.privateKey)
            try {
                const provider = getPQProvider()
                const { secretKey } =
                    provider.generateKeypairFromSeed(seedBytes)
                try {
                    return payloads.map(payload =>
                        provider.sign(secretKey, payload),
                    )
                } finally {
                    zeroBytes(secretKey)
                }
            } finally {
                zeroBytes(seedBytes)
            }
        })

    /**
     * Returns the Falcon public-key bytes committed on the quantum signing
     * child at `keyPairId` (the id `createQuantumKey` returns as
     * `signKeyId`, and what `account.keyPairId` is set to for quantum
     * accounts). Reads from the live reactive store rather than
     * `keyStore.export`: the child is minted `extractable: false`, so only the
     * public half the keystore records on the entry is readable at all.
     */
    const getQuantumPublicKey = (keyPairId: string): Uint8Array => {
        const child = getKeystoreStore().state.keys.find(
            k => k.id === keyPairId,
        )
        if (!child?.publicKey) {
            throw new KeyManagementError(
                `No quantum public key for keyPairId ${keyPairId}`,
            )
        }
        // Guard the algorithm at the point of use: a non-quantum keyPairId
        // (e.g. an Ed25519 child) also carries a `publicKey`, so without this
        // check we would silently hand back the wrong bytes for a caller that
        // resolved account.keyPairId to a non-Falcon child.
        if (child.type !== FALCON_CHILD_KEY_TYPE) {
            throw new KeyManagementError(
                `keyPairId ${keyPairId} is not a quantum key (type: ${child.type})`,
            )
        }
        return new Uint8Array(child.publicKey)
    }

    /**
     * Describes how to build a signed transaction for `keyPairId`.
     *
     * Returns the PQ scheme id and public key for a post-quantum child, or
     * `null` for an Ed25519 child. Callers use the `null` case to pick the
     * plain `sig` path — this is the single place the scheme is decided, so
     * signing callers need no account-type branching.
     *
     * Standardised on the SAME oracle {@link signTransactionsWithKey} uses
     * to pick its signer — the seed's committed `scheme`, via
     * `resolveSeedKey` + `seedSchemeOf` — rather than the child's own
     * `type`. Payload selection (here) and signer selection
     * (`signTransactionsWithKey`) must never be able to disagree: if they
     * did, this would return `null`, the caller would sign the un-digested
     * `encodeTransaction(txn)` bytes, and `signTransactionsWithKey` would
     * still route to the real Falcon signer — silently re-creating the
     * exact un-digested-signing bug PERA-4653 closed.
     *
     * The child's `type` is still cross-checked as a consistency guard
     * (e.g. `account.keyPairId` resolving to the quantum *seed* id itself,
     * which `resolveSeedKey` accepts as a legacy-caller convenience,
     * disagrees with the seed's own scheme here). A mismatch THROWS rather
     * than falling back to the ed25519 path — silent fallthrough is exactly
     * the failure mode this function exists to prevent.
     */
    const getPQSigningInfo = (
        keyPairId: string,
    ): { schemeId: PQSchemeId; publicKey: Uint8Array } | null => {
        const seedKey = resolveSeedKey(keyPairId)
        const isQuantumSeed = seedSchemeOf(seedKey) === SeedScheme.Quantum

        const child = getKeystoreStore().state.keys.find(
            k => k.id === keyPairId,
        )
        const isFalconChild = child?.type === FALCON_CHILD_KEY_TYPE

        if (isQuantumSeed !== isFalconChild) {
            throw new KeyManagementError(
                `PQ scheme mismatch for keyPairId ${keyPairId}: seed scheme reports quantum=${isQuantumSeed}, child type reports ${FALCON_CHILD_KEY_TYPE}=${isFalconChild}`,
            )
        }

        if (!isQuantumSeed) {
            return null
        }

        // Report the PROVIDER's own scheme rather than a literal of our own:
        // `getPQProvider()` is the build-time-selected implementation and is
        // the authority on which scheme it produces signatures for, so a
        // second PQ provider needs no edit here.
        return {
            schemeId: getPQProvider().scheme,
            publicKey: getQuantumPublicKey(keyPairId),
        }
    }

    const hasSeedWithEntropy = useCallback((seedKeyId: string): boolean => {
        const keys = getKeystoreStore().state.keys
        const seed = keys.find(k => k.id === seedKeyId)
        if (!seed || !isSeedKey(seed)) return false
        return entropyChildIdOf(seedKeyId, keys) !== undefined
    }, [])

    /**
     * Signs each item with the child key at `childKeyId`.
     */
    const signTransactionsWithKey = async (
        childKeyId: string,
        domain: string,
        encodedTxs: Uint8Array[],
    ): Promise<Uint8Array[]> => {
        const seedKey = resolveSeedKey(childKeyId)
        checkAccess(seedKey, domain)
        if (seedSchemeOf(seedKey) === SeedScheme.Quantum) {
            return signWithQuantumSeed(seedKey, encodedTxs)
        }
        return Promise.all(encodedTxs.map(tx => keyStore.sign(childKeyId, tx)))
    }

    const signDataWithKey = async (
        childKeyId: string,
        domain: string,
        data: Uint8Array[],
    ): Promise<Uint8Array[]> => {
        const seedKey = resolveSeedKey(childKeyId)
        checkAccess(seedKey, domain)
        if (seedSchemeOf(seedKey) === SeedScheme.Quantum) {
            return signWithQuantumSeed(seedKey, data)
        }
        return Promise.all(data.map(d => keyStore.sign(childKeyId, d)))
    }

    const resolveSeedKey = useCallback(
        (childKeyId: string): Key => {
            const parentId = seedIdOf(childKeyId)
            if (!parentId) {
                // Caller might have passed a seed id directly — accept it
                // as a convenience for callers that haven't migrated yet.
                const direct = getKeyOrThrow(childKeyId)
                if (isSeedKey(direct)) return direct
                throw new InvalidKeyError(childKeyId)
            }
            return getKeyOrThrow(parentId)
        },
        [seedIdOf, getKeyOrThrow],
    )

    /**
     * Runs `handler` with the mnemonic for the seed that minted `childKeyId`,
     * passed as a zeroable `Uint16Array` of BIP39 wordlist indices. The phrase
     * is rebuilt from keystore material (the BIP39 entropy secret-key, or the
     * algo25 seed) only for the duration of this call; the intermediate byte
     * buffers and the index buffer are all zeroed in `finally`.
     *
     * Indices (not `string[]`) are the currency here so the secret retained
     * across the handler's work — which may be async and PIN-gated — is a
     * buffer we can actually scrub, and holds opaque numbers rather than the
     * dictionary words a memory scanner could grep for. Handlers materialize
     * individual words via `mnemonicIndexToWord` only at the point of use.
     */
    const executeWithMnemonic = async <T>(
        childKeyId: string,
        domain: string,
        handler: ExecuteWithMnemonicHandler<T>,
    ): Promise<T> => {
        const seedKey = resolveSeedKey(childKeyId)
        checkAccess(seedKey, domain)
        const scheme = seedSchemeOf(seedKey)
        if (!scheme) throw new InvalidKeyError(seedKey.id)

        const runWithIndices = async (indices: Uint16Array): Promise<T> => {
            try {
                return await handler(indices)
            } finally {
                zeroBytes(indices)
            }
        }

        if (scheme === SeedScheme.Bip39) {
            // The HD entropy lives in its own `secret-key` child (located by
            // metadata, not a derived id), so the seed's XHD root is never
            // exported just to recover the phrase. entropy → indices directly:
            // the phrase is never a string on the heap.
            const entropyId = entropyChildIdOf(seedKey.id, keystoreKeys)
            const indices = entropyId
                ? await withSecret(entropyId, entropy =>
                      entropyToIndices(entropy),
                  )
                : null
            if (!indices) {
                throw new KeyManagementError(
                    'HD seed is missing its entropy secret',
                )
            }
            return runWithIndices(indices)
        }

        // algo25 / quantum: the phrase derives from the seed's own
        // private-key bytes — both schemes share the 25-word format
        // (24 data words + 1 checksum over 32 bytes of entropy).
        return withExportedKey(seedKey.id, async seedData => {
            if (!seedData.privateKey) {
                throw new KeyManagementError('Seed has no private key bytes')
            }
            const seedBytes = new Uint8Array(seedData.privateKey)
            let indices: Uint16Array
            try {
                indices = algo25SeedToIndices(seedBytes)
            } finally {
                zeroBytes(seedBytes)
            }
            return runWithIndices(indices)
        })
    }

    return {
        keys: seeds,
        seedIdOf,
        removeKeyAndChildren,
        deleteKey,
        getKey,
        getKeyOrThrow,
        hasSeedWithEntropy,
        createAlgo25Key,
        createQuantumKey,
        createHDWalletKey,
        persistHDMasterKey,
        generateDerivedKey,
        getDerivedPublicKey,
        getQuantumPublicKey,
        getPQSigningInfo,
        withExportedKey,
        signTransactionsWithKey,
        signDataWithKey,
        executeWithMnemonic,
    }
}
