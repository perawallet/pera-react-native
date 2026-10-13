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

import { LogicSigAccount, decodeAddress } from 'algosdk'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
    concatBytes,
} from '@perawallet/wallet-core-shared'

const PROGRAM_PREFIX = new TextEncoder().encode('Program')

/** The bytes an ed25519 delegated-LSig signature must cover. */
export const programSigningPayload = (program: Uint8Array): Uint8Array =>
    concatBytes(PROGRAM_PREFIX, program)

/**
 * Thrown when an assembled delegated LogicSig fails local signature
 * verification against the signer's public key — a wrong signer address, a
 * corrupt signature, or a program/signature mismatch.
 */
export class LsigSignatureVerificationError extends AppError {
    constructor(signerAddress: string) {
        super(
            `Delegated LogicSig signature failed verification for ${signerAddress}`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.TRANSACTIONS,
                recoverable: false,
            },
        )
        this.name = 'LsigSignatureVerificationError'
    }
}

/**
 * Builds the msgpack-encoded delegated `LogicSigAccount` from a program, an
 * externally produced ed25519 signature over `"Program" || program`, and the
 * signer's address. Records the signer's public key (`sigkey`) so the
 * delegation can be verified without the escrow address — the wire shape the
 * card delegation registration expects (`LogicSigAccount.toByte()`).
 *
 * Throws {@link LsigSignatureVerificationError} if the signature does not
 * verify against the signer's public key.
 */
export const encodeDelegatedLsigAccount = (
    program: Uint8Array,
    sig: Uint8Array,
    signerAddress: string,
): Uint8Array => {
    const publicKey = decodeAddress(signerAddress).publicKey
    const lsigAccount = new LogicSigAccount(program)
    lsigAccount.lsig.sig = sig
    lsigAccount.sigkey = publicKey
    if (!lsigAccount.lsig.verify(publicKey)) {
        throw new LsigSignatureVerificationError(signerAddress)
    }
    return lsigAccount.toByte()
}
