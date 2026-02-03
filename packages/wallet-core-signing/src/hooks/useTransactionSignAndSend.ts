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
import {
    useAlgorandClient,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { useTransactionSigner } from '@perawallet/wallet-core-accounts'
import type { TransactionSignRequest } from '../models'
import { useSigningRequest } from './useSigningRequest'

export const useTransactionSignAndSend = () => {
    const { removeSignRequest } = useSigningRequest()
    const { signTransactions } = useTransactionSigner()
    const { encodeSignedTransactions } = useTransactionEncoder()
    const algokit = useAlgorandClient()

    const signAndSend = useCallback(
        async (request: TransactionSignRequest) => {
            const signedTxs = await Promise.all(
                request.txs.map(txs => {
                    return signTransactions(
                        txs,
                        request.txs.map((_, idx) => idx),
                    )
                }),
            )
            if (request.transport === 'algod') {
                signedTxs.forEach(group => {
                    algokit.client.algod.sendRawTransaction(
                        encodeSignedTransactions(group),
                    )
                })
            } else {
                await request.approve?.(signedTxs)
            }
            removeSignRequest(request)
        },
        [
            signTransactions,
            algokit,
            encodeSignedTransactions,
            removeSignRequest,
        ],
    )

    const rejectRequest = useCallback(
        (request: TransactionSignRequest) => {
            if (request.transport === 'callback') {
                request.reject?.()
            }
            removeSignRequest(request)
        },
        [removeSignRequest],
    )

    return { signAndSend, rejectRequest }
}
