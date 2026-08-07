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

import { encodeToBase64, type Nullable } from '@perawallet/wallet-core-shared'

/**
 * Maps assembled signed-transaction bytes back into the WalletConnect
 * `algo_signTxn` result shape: a `totalLength`-slot array where each signed
 * item sits at its original group position (`indicesToSign[i]`) and every
 * other slot is `null` (the dApp asked this wallet to sign only a subset).
 *
 * Shared by the live delivery closure and the relaunch-recovery path so both
 * produce a byte-identical response — the recovery path can't capture the
 * closure, only the serializable `{ indicesToSign, totalLength }`.
 *
 * `signedBytes[i]` is the assembled composite for the transaction at
 * `indicesToSign[i]`; both arrays are parallel and in proposal order.
 */
export const buildWalletConnectSignResult = (
    signedBytes: Uint8Array[],
    indicesToSign: number[],
    totalLength: number,
): Nullable<string>[] => {
    const result: Nullable<string>[] = new Array(totalLength).fill(null)
    signedBytes.forEach((bytes, i) => {
        const idx = indicesToSign[i]
        if (idx === undefined || !bytes) return
        result[idx] = encodeToBase64(bytes)
    })
    return result
}
