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

import { useCallback } from 'react'
import { microAlgo } from '@algorandfoundation/algokit-utils'
import {
    isValidAlgorandAddress,
    useAlgorandClient,
} from '@perawallet/wallet-core-blockchain'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    decodeFromBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import type { KeyregDeeplink } from '../types'

export type KeyregDeeplinkHandler = (data: KeyregDeeplink) => Promise<void>

/**
 * Native pera QR generators emit unpadded base64 (a 32-byte key encodes to
 * 43 chars; standard base64 would pad to 44). `base64-js.toByteArray` —
 * what `decodeFromBase64` calls under the hood — requires the input length
 * to be a multiple of 4, so unpadded keys throw "Invalid string. Length
 * must be a multiple of 4". Re-pad before decoding so URL-safe and
 * unpadded forms both work.
 */
const decodeKeyregBase64 = (key: string): Uint8Array => {
    const padLen = (4 - (key.length % 4)) % 4
    return decodeFromBase64(key + '='.repeat(padLen))
}

/**
 * Builds a key-registration transaction from the deeplink payload (online
 * or offline) and submits it through the signing pipeline. SignRequestView
 * already renders a keyreg summary screen (see
 * packages/blockchain/src/utils/transactions.ts → keyregTransaction display
 * mapping) so the user reviews then signs without a separate UI here.
 *
 * Online keyreg requires every participation key field to be present —
 * partial deeplinks are rejected rather than producing a malformed txn.
 */
export const useKeyregDeeplink = (): KeyregDeeplinkHandler => {
    const algorandClient = useAlgorandClient()
    const { addSignRequest } = useSigningRequest()
    const { errorToast } = useToast()
    const { t } = useLanguage()

    return useCallback(
        async (data: KeyregDeeplink) => {
            if (!isValidAlgorandAddress(data.senderAddress)) {
                errorToast(
                    t('errors.deeplink.invalid_url_title'),
                    t('errors.deeplink.invalid_url_body'),
                )
                return
            }

            // Editable note + locked xnote both end up in the txn note. Native
            // shows xnote read-only in its review UI; the signing modal here
            // just displays the resulting note string.
            const note = data.note ?? data.xnote
            const noteBytes = note ? new TextEncoder().encode(note) : undefined
            const staticFee = data.fee ? microAlgo(BigInt(data.fee)) : undefined

            let tx
            if (data.keyregType === 'offline') {
                tx =
                    await algorandClient.createTransaction.offlineKeyRegistration(
                        {
                            sender: data.senderAddress,
                            note: noteBytes,
                            staticFee,
                        },
                    )
            } else {
                if (
                    !data.voteKey ||
                    !data.selkey ||
                    !data.sprfkey ||
                    !data.votefst ||
                    !data.votelst ||
                    !data.votekd
                ) {
                    errorToast(
                        t('errors.deeplink.invalid_url_title'),
                        t('errors.deeplink.invalid_url_body'),
                    )
                    return
                }
                tx =
                    await algorandClient.createTransaction.onlineKeyRegistration(
                        {
                            sender: data.senderAddress,
                            voteKey: decodeKeyregBase64(data.voteKey),
                            selectionKey: decodeKeyregBase64(data.selkey),
                            stateProofKey: decodeKeyregBase64(data.sprfkey),
                            voteFirst: BigInt(data.votefst),
                            voteLast: BigInt(data.votelst),
                            voteKeyDilution: BigInt(data.votekd),
                            note: noteBytes,
                            staticFee,
                        },
                    )
            }

            addSignRequest({
                id: generateOrderedUniqueId(),
                type: 'transactions',
                transport: 'algod',
                sourceType: 'local',
                txs: [tx],
            })
        },
        [addSignRequest, algorandClient, errorToast, t],
    )
}
