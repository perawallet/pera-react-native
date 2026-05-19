/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { LedgerSigningError } from './errors'

/**
 * Normalize the raw `signature` field returned by `@ledgerhq/hw-app-algorand`'s
 * `sign()` into a real Ed25519 signature.
 *
 * hw-app-algorand (^6.34) returns the raw APDU response including the
 * trailing 2-byte status word (SW_OK = 0x9000). The base
 * @ledgerhq/hw-transport.send() validates the SW but returns the buffer
 * with it still appended. Strip those bytes so callers get a real 64-byte
 * Ed25519 signature — otherwise multisig cosign Ed25519 verification
 * fails on the backend and algod submissions are rejected as InvalidSignature.
 *
 * Throws `LedgerSigningError` for null/empty input or a response too short
 * to contain the trailing SW.
 */
export const extractLedgerSignature = (
    signature: Uint8Array | null | undefined,
): Uint8Array => {
    if (!signature) {
        throw new LedgerSigningError('Empty signature returned')
    }
    const sig = Uint8Array.from(signature)
    if (sig.length < 2) {
        throw new LedgerSigningError(
            `Ledger returned ${sig.length}-byte response; expected sig + SW`,
        )
    }
    return sig.subarray(0, sig.length - 2)
}
