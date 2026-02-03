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
    useArbitraryDataSigner,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type { ArbitraryDataSignRequest } from '../models'
import { useSigningRequest } from './useSigningRequest'

export const useArbitraryDataSignAndSend = () => {
    const { removeSignRequest } = useSigningRequest()
    const { signArbitraryData } = useArbitraryDataSigner()
    const allAccounts = useAllAccounts()

    const signAndSend = useCallback(
        async (request: ArbitraryDataSignRequest) => {
            if (request.transport === 'algod') {
                removeSignRequest(request)
                throw new Error(
                    'Arbitrary data signing is not supported via algod transport',
                )
            }

            const signedData = request.data.map(async data => {
                const account = allAccounts.find(
                    account => account.address === data.signer,
                )

                if (!account) {
                    removeSignRequest(request)
                    throw new Error(
                        `Account not found for signer: ${data.signer}`,
                    )
                }
                const signature = await signArbitraryData(
                    account,
                    data.data,
                )
                if (!signature?.length) {
                    removeSignRequest(request)
                    throw new Error(
                        `Failed to generate signature for signer: ${data.signer}`,
                    )
                }

                return {
                    signer: account.address,
                    signature: signature[0],
                }
            })

            const signatures = await Promise.all(signedData)
            await request.approve?.(signatures)
            removeSignRequest(request)
        },
        [removeSignRequest, signArbitraryData, allAccounts],
    )

    const rejectRequest = useCallback(
        (request: ArbitraryDataSignRequest) => {
            removeSignRequest(request)
            if (request.transport === 'callback') {
                request.reject?.()
            }
        },
        [removeSignRequest],
    )

    return { signAndSend, rejectRequest }
}
