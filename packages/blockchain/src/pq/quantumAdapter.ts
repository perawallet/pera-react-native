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

// SWAP: joe-p @joe-p/algosdk PQ surface — the ONLY module importing it.
// Replace with the official algosdk once pqsig lands; if pqsig becomes mainline,
// delete this module and use the normal SignedTransaction path. See Seam B in
// docs/QUANTUM_PQ_INTEGRATION.md.
import {
    addressFromPQKey,
    FALCON_1024_SCHEME,
    addressWithSignersFromRawFalcon1024Signer,
    decodeUnsignedTransaction,
} from '@joe-p/algosdk'

export const deriveQuantumAddress = (publicKey: Uint8Array): string =>
    addressFromPQKey(FALCON_1024_SCHEME, publicKey).address.toString()

export const assembleQuantumSignedTxn = async (input: {
    unsignedTxnBytes: Uint8Array
    publicKey: Uint8Array
    falconSignature: Uint8Array
}): Promise<Uint8Array> => {
    const txn = decodeUnsignedTransaction(input.unsignedTxnBytes)
    // The fork's raw signer builds the pqsig SignedTransaction (computing the
    // salt and the rekey `sgnr` from the txn's own sender vs. the derived
    // quantum address) and returns node-ready msgpack bytes. We feed it the
    // pre-computed Falcon signature verbatim (no re-signing). Rekey needs no
    // extra arg here: leaving `sendingAddress` unset makes the fork set
    // `sgnr` automatically whenever the txn sender differs from the derived
    // quantum address. If an explicit sender override is ever required, the
    // fork's optional `sendingAddress` argument is the seam.
    const { txnSigner } = addressWithSignersFromRawFalcon1024Signer({
        falcon1024PublicKey: input.publicKey,
        falcon1024Signer: () => Promise.resolve(input.falconSignature),
    })
    const [signed] = await txnSigner([txn], [0])
    return signed
}
