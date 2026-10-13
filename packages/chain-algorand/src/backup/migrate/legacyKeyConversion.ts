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

import {
    algo25SecretKeyToIndices,
    entropyToIndices,
} from '@perawallet/wallet-core-kms'
import type { LegacyHDWallet } from '@perawallet/wallet-extension-platform'

export { algo25SecretKeyToIndices }

export const hdWalletEntropyToIndices = (
    parent: LegacyHDWallet,
): Uint16Array => {
    if (parent.entropy && parent.entropy.length > 0) {
        const entropy = Uint8Array.from(parent.entropy)
        try {
            return entropyToIndices(entropy)
        } finally {
            entropy.fill(0)
        }
    }
    throw new Error(`HD wallet ${parent.walletId} has no entropy`)
}

export const describeBytes = (bytes: Uint8Array | null): string => {
    if (bytes === null) return 'null'
    if (bytes.length === 0) return 'empty'
    return `${bytes.length}B`
}
