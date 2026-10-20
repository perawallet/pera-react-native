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
    ChainActionData,
    ChainScope,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { ChainActionBuildError } from '@perawallet/wallet-core-deeplinks'
import { decodeFromBase64, toBigInt } from '@perawallet/wallet-core-shared'
import { toUnsignedAlgorandTransaction } from '../signing/unsignedTransaction'
import { buildKeyRegistrationTx } from '../transactions/builders'

/**
 * Native QR generators emit unpadded base64 (a 32-byte key is 43 chars, not
 * 44), which `base64-js` rejects — it needs a length divisible by 4. Re-pad so
 * URL-safe and unpadded forms both decode.
 */
const decodeKeyregBase64 = (key: string): Uint8Array => {
    const padLen = (4 - (key.length % 4)) % 4
    return decodeFromBase64(key + '='.repeat(padLen))
}

// `keyreg` is the only Algorand chain action.
export const buildAlgorandChainAction = async (
    chainData: ChainActionData,
    { scope }: { scope: ChainScope },
): Promise<UnsignedTransaction> => {
    // Editable note + locked xnote both end up in the txn note. Native shows
    // xnote read-only in its review UI; the signing modal here just displays
    // the resulting note string.
    const note = chainData.note ?? chainData.xnote
    const common = {
        scope,
        sender: chainData.sender,
        note: note ? new TextEncoder().encode(note) : undefined,
        // An out-of-range fee is caught at review time by the high-fee warning.
        fee: chainData.fee ? toBigInt(chainData.fee) : undefined,
    }

    if (chainData.keyregType === 'offline') {
        return toUnsignedAlgorandTransaction(
            await buildKeyRegistrationTx({ ...common, kind: 'offline' }),
            scope,
        )
    }

    const {
        voteKey,
        selectionKey,
        stateProofKey,
        voteFirst,
        voteLast,
        voteKeyDilution,
    } = chainData
    if (
        !voteKey ||
        !selectionKey ||
        !stateProofKey ||
        !voteFirst ||
        !voteLast ||
        !voteKeyDilution
    ) {
        throw new ChainActionBuildError(
            'missing-fields',
            'Missing required participation key fields',
        )
    }
    return toUnsignedAlgorandTransaction(
        await buildKeyRegistrationTx({
            ...common,
            kind: 'online',
            voteKey: decodeKeyregBase64(voteKey),
            selectionKey: decodeKeyregBase64(selectionKey),
            stateProofKey: decodeKeyregBase64(stateProofKey),
            voteFirst: BigInt(voteFirst),
            voteLast: BigInt(voteLast),
            voteKeyDilution: BigInt(voteKeyDilution),
        }),
        scope,
    )
}
