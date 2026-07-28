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

import { addressFromPQKey, SignedTransaction, type Transaction } from 'algosdk'
import { sha512_256 } from '@noble/hashes/sha2'
import { DEFAULT_PQ_SCHEME_ID, PQ_SCHEMES, type PQSchemeId } from './schemes'
import type { PQSignature } from '../models'

/**
 * The exact bytes a post-quantum signer must sign for `txn`.
 *
 * This is SHA-512/256 over the "TX"-prefixed msgpack encoding — i.e. the
 * digest of `txn.bytesToSign()`, not the encoding itself. Signing the
 * un-digested encoding produces a signature the protocol will not verify.
 * Pinned by the differential test in `__tests__/quantumAdapter.spec.ts`,
 * which compares our assembled bytes against algosdk's own PQ signer.
 */
export const pqSigningDigest = (txn: Transaction): Uint8Array =>
    sha512_256(txn.bytesToSign())

/** The address a post-quantum public key authorizes under `schemeId`. */
export const deriveQuantumAddress = (
    publicKey: Uint8Array,
    schemeId: PQSchemeId = DEFAULT_PQ_SCHEME_ID,
): string =>
    addressFromPQKey(PQ_SCHEMES[schemeId], publicKey).address.toString()

/**
 * Builds the signed transaction for a post-quantum signature.
 *
 * Structurally identical to the Ed25519 path (`new SignedTransaction({ txn,
 * sig, sgnr })`) — it just fills `pqsig` instead of `sig`. `sgnr` is set
 * whenever the transaction's sender differs from the address the PQ key
 * authorizes, which is exactly the rekey case.
 */
export const assemblePQSignedTransaction = (input: {
    txn: Transaction
    signature: PQSignature
}): SignedTransaction => {
    const { txn, signature } = input
    const scheme = PQ_SCHEMES[signature.schemeId]
    const { address, salt } = addressFromPQKey(scheme, signature.publicKey)

    return new SignedTransaction({
        txn,
        pqsig: {
            sch: scheme,
            slt: salt,
            pk: signature.publicKey,
            sig: signature.signature,
        },
        sgnr: txn.sender.equals(address) ? undefined : address,
    })
}
