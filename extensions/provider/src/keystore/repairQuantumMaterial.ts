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

import type { Key } from '@algorandfoundation/keystore-core'
import { MATERIAL_PREFIX } from '@algorandfoundation/react-native-keystore'
import {
    PQ_DERIVATION_LEGACY,
    PQ_DERIVATION_CANONICAL,
    type PQDerivation,
} from './pqDerivation'

const FALCON_CHILD_TYPE = 'falcon-1024'

/**
 * The slice of the keystore this repair stands on. Injected rather than
 * imported directly so the module carries no native dependency: the keystore
 * package pulls in `react-native-quick-crypto`, which cannot be loaded off
 * device.
 */
export type QuantumMaterialRepairDeps = {
    /** Snapshot of the engine's reactive keys, post-hydration. */
    keys: () => Key[]
    storage: { getString: (key: string) => string | undefined }
    /**
     * Re-mints the Falcon child from its parent seed, sealing the private half.
     * `derivation` selects which entropy→keygen-seed mapping to reproduce —
     * get it wrong and the child's address changes.
     */
    regenerate: (
        childId: string,
        parentKeyId: string,
        derivation: PQDerivation,
    ) => Promise<void>
}

export type QuantumMaterialRepairResult = {
    repaired: number
    /** Left as-is; the account stays unusable but nothing was destroyed. */
    failed: number
}

/**
 * Re-seals the Falcon private key of quantum children that never had one.
 *
 * Before this branch, quantum signing exported the seed and re-derived the
 * Falcon keypair in JS on every signature, so the child entry only ever held a
 * public key. Custody now lives in the keystore and `sign` reads sealed
 * material at the child's own id, which an account created by the old path
 * simply does not have — it would fail with "does not hold Falcon bytes" at
 * submit time, after the user has signed.
 *
 * Falcon derivation is deterministic in the seed, so re-minting reproduces the
 * same keypair and the account's address is unchanged. The public key is
 * compared afterwards and a mismatch is reported rather than trusted: a changed
 * public key would mean a changed address, and a malformed stored key is
 * invisible from the address, because `PQAddress(scheme, salt, publicKey)` stays
 * self-consistent with whatever bytes were stored.
 */
export const repairQuantumMaterial = async (
    deps: QuantumMaterialRepairDeps,
): Promise<QuantumMaterialRepairResult> => {
    const result: QuantumMaterialRepairResult = { repaired: 0, failed: 0 }

    const orphans = deps
        .keys()
        .filter(
            key =>
                key.type === FALCON_CHILD_TYPE &&
                !deps.storage.getString(MATERIAL_PREFIX + key.id),
        )

    for (const child of orphans) {
        const parentKeyId = (child.metadata as { parentKeyId?: string })
            ?.parentKeyId
        if (!parentKeyId) {
            console.error(
                `[provider] quantum repair: ${child.id} has no parent seed to re-derive from`,
            )
            result.failed += 1
            continue
        }

        const derivation = (child.metadata as { pqDerivation?: PQDerivation })
            ?.pqDerivation
        if (
            derivation !== PQ_DERIVATION_LEGACY &&
            derivation !== PQ_DERIVATION_CANONICAL
        ) {
            // Revision 0004 stamps this. Until it has, re-deriving would be a
            // coin flip between two different addresses.
            console.error(
                `[provider] quantum repair: ${child.id} has no derivation marker; refusing to re-derive`,
            )
            result.failed += 1
            continue
        }

        const before = child.publicKey

        try {
            await deps.regenerate(child.id, parentKeyId, derivation)
        } catch (err) {
            console.error(
                `[provider] quantum repair: ${child.id} could not be re-minted`,
                err,
            )
            result.failed += 1
            continue
        }

        const after = deps.keys().find(key => key.id === child.id)?.publicKey
        if (before && after && !bytesEqual(before, after)) {
            console.error(
                `[provider] quantum repair: ${child.id} re-derived to a different public key; its address would change`,
            )
            result.failed += 1
            continue
        }

        result.repaired += 1
    }

    return result
}

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
    a.length === b.length && a.every((byte, index) => byte === b[index])
