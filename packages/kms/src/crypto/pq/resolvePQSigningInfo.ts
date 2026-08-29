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
import type { PQSchemeId } from '@perawallet/wallet-core-blockchain'
import { SeedScheme } from '../../constants'
import {
    InvalidKeyError,
    KeyManagementError,
    KeyNotFoundError,
} from '../../errors'
import { FALCON_CHILD_KEY_TYPE } from '../../models/keys'
import { isSeedKey, seedSchemeOf } from '../../utils'
import { getPQProvider } from './index'

export type PQSigningInfo = { schemeId: PQSchemeId; publicKey: Uint8Array }

const parentIdOf = (key: Key | undefined): string | undefined => {
    const parentKeyId = (key?.metadata as Record<string, unknown> | undefined)
        ?.parentKeyId
    return typeof parentKeyId === 'string' ? parentKeyId : undefined
}

/**
 * The seed key that minted `childKeyId`, resolved from a keystore snapshot.
 *
 * A seed id passed directly is accepted as a convenience for callers that
 * haven't migrated to child ids — the same allowance `useKMS.resolveSeedKey`
 * makes, and the reason the mismatch guard below has to exist.
 *
 * Key EXPIRY is deliberately not checked here: sweeping an expired seed means
 * deleting it, which is the store binding's job (`useKMS.getKey`), not a pure
 * function's. A caller reaching this directly with its own snapshot — as the
 * conformance harness does — gets no expiry enforcement.
 */
export const resolveSeedKeyFrom = (
    keys: readonly Key[],
    childKeyId: string,
): Key => {
    const parentId = parentIdOf(keys.find(k => k.id === childKeyId))
    if (!parentId) {
        const direct = keys.find(k => k.id === childKeyId)
        if (!direct) throw new KeyNotFoundError(childKeyId)
        if (isSeedKey(direct)) return direct
        throw new InvalidKeyError(childKeyId)
    }
    const seed = keys.find(k => k.id === parentId)
    if (!seed) throw new KeyNotFoundError(parentId)
    return seed
}

/**
 * Describes how to build a signed transaction for `keyPairId`: the PQ scheme
 * id and public key for a post-quantum child, or `null` for an Ed25519 one.
 * Callers use the `null` case to pick the plain `sig` path — this is the
 * single place the scheme is decided, so signing callers need no
 * account-type branching.
 *
 * Standardised on the SAME oracle the signer selection uses — the seed's
 * committed `scheme` — rather than the child's own `type`. Payload selection
 * and signer selection must never be able to disagree: if they did, this
 * would return `null`, the caller would sign the un-digested
 * `encodeTransaction(txn)` bytes, and the keystore would still route to the
 * real Falcon signer, silently re-creating the un-digested-signing bug.
 *
 * The child's `type` is still cross-checked as a consistency guard. A
 * mismatch THROWS rather than falling back to the ed25519 path — silent
 * fallthrough is exactly the failure mode this function exists to prevent.
 *
 * Pure and snapshot-driven so the LocalNet conformance suite can prove this
 * decision against a real `pqsig`-verifying node, rather than a test
 * reimplementing it.
 */
export const resolvePQSigningInfo = (
    keys: readonly Key[],
    keyPairId: string,
): PQSigningInfo | null => {
    const seedKey = resolveSeedKeyFrom(keys, keyPairId)
    const isQuantumSeed = seedSchemeOf(seedKey) === SeedScheme.Quantum

    const child = keys.find(k => k.id === keyPairId)
    const isFalconChild = child?.type === FALCON_CHILD_KEY_TYPE

    if (isQuantumSeed !== isFalconChild) {
        throw new KeyManagementError(
            `PQ scheme mismatch for keyPairId ${keyPairId}: seed scheme reports quantum=${isQuantumSeed}, child type reports ${FALCON_CHILD_KEY_TYPE}=${isFalconChild}`,
        )
    }

    if (!isQuantumSeed) {
        return null
    }

    if (!child?.publicKey) {
        throw new KeyManagementError(
            `No quantum public key for keyPairId ${keyPairId}`,
        )
    }

    // Report the PROVIDER's own scheme rather than a literal of our own:
    // `getPQProvider()` is the build-time-selected implementation and is the
    // authority on which scheme it produces signatures for, so a second PQ
    // provider needs no edit here.
    return {
        schemeId: getPQProvider().scheme,
        publicKey: new Uint8Array(child.publicKey),
    }
}
