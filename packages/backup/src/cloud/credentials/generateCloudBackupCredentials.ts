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

import { entropyToIndices, zeroBytes } from '@perawallet/wallet-core-kms'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

const MNEMONIC_ENTROPY_BYTES = 16

const SALT_BYTES = 16

const generateSecureRandomBytes = (length: number): Uint8Array => {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return bytes
}

export type CloudBackupCredentials = {
    /** Zeroable buffer the caller owns; resolve to words only at display time. */
    mnemonicIndices: Uint16Array
    /** Base64-encoded salt. */
    salt: string
}

export const generateCloudBackupCredentials = (): CloudBackupCredentials => {
    const entropy = generateSecureRandomBytes(MNEMONIC_ENTROPY_BYTES)
    const saltBytes = generateSecureRandomBytes(SALT_BYTES)

    try {
        return {
            mnemonicIndices: entropyToIndices(entropy),
            salt: encodeToBase64(saltBytes),
        }
    } finally {
        zeroBytes(entropy, saltBytes)
    }
}
