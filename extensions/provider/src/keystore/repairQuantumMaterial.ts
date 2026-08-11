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
import { MATERIAL_PREFIX } from './prefixes'

const FALCON_CHILD_TYPE = 'falcon-1024'

/**
 * The slice of the keystore this repair stands on. Injected for the same reason
 * the layout migration injects its own: the keystore package pulls in
 * `react-native-quick-crypto` and cannot be loaded off device.
 */
export type QuantumMaterialRepairDeps = {
    /** Snapshot of the engine's reactive keys, post-hydration. */
    keys: () => Key[]
    storage: { getString: (key: string) => string | undefined }
    /**
     * Re-mints the Falcon child from its parent seed, sealing the private half.
     * Resolves the seed through the driver, so it never reaches JS.
     */
    regenerate: (childId: string, parentKeyId: string) => Promise<void>
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
 * public key would mean a changed address, and per the PQ-020 note in
 * `docs/QUANTUM_PQ_INTEGRATION.md` that is invisible from the address alone.
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

        const before = child.publicKey

        try {
            await deps.regenerate(child.id, parentKeyId)
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
