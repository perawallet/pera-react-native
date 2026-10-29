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

import type {
    ConnectionPeerVerification,
    ConnectionPeerVerificationStatus,
} from '@perawallet/wallet-extension-connections'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { WalletKitVerifyContext } from './client'

const statusOf = (
    verified: Optional<WalletKitVerifyContext['verified']>,
): ConnectionPeerVerificationStatus => {
    if (verified?.isScam === true) return 'scam'
    if (verified?.validation === 'VALID') return 'valid'
    if (verified?.validation === 'INVALID') return 'mismatch'
    return 'unknown'
}

export const toPeerVerification = (
    context: Optional<WalletKitVerifyContext>,
): ConnectionPeerVerification => {
    const verified = context?.verified
    const status = statusOf(verified)
    // Without an attestation sign-client echoes the peer's own url as `origin`,
    // so unknown never carries it. Link mode echoes it under VALID/INVALID too:
    // guard here before enabling `redirect.linkMode` in the client metadata.
    const origin = verified?.origin
    return status !== 'unknown' && typeof origin === 'string' && origin !== ''
        ? { status, verifiedOrigin: origin }
        : { status }
}
