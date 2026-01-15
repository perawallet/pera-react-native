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

import {
    useAllAccounts,
    useArbitraryDataSigner,
} from '@perawallet/wallet-core-accounts'
import {
    ArbitraryDataSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useCallback, useState } from 'react'

export const useArbitraryDataSigningView = (
    request: ArbitraryDataSignRequest,
) => {
    const { t } = useLanguage()
    const { removeSignRequest } = useSigningRequest()
    const { showToast } = useToast()
    const { signArbitraryData } = useArbitraryDataSigner()
    const allAccounts = useAllAccounts()
    const [isPending, setIsPending] = useState(false)

    const approveRequest = useCallback(async () => {
        if (request.transport === 'algod') {
            removeSignRequest(request)
            throw new Error(t('signing.arbitrary_data_view.algod_not_valid'))
        }

        setIsPending(true)
        const signedData = request.data.map(async data => {
            const account = allAccounts.find(
                account => account.address === data.signer,
            )

            if (!account) {
                removeSignRequest(request)
                throw new Error(
                    t('signing.arbitrary_data_view.account_not_found'),
                )
            }
            const signature = await signArbitraryData(account, data.data)
            if (!signature?.length) {
                removeSignRequest(request)
                throw new Error(
                    t('signing.arbitrary_data_view.signature_not_found'),
                )
            }

            return {
                signer: account.address,
                signature: signature[0],
            }
        })
        try {
            const signatures = await Promise.all(signedData)
            await request.approve?.(signatures)
            showToast({
                title: t('signing.arbitrary_data_view.success_title'),
                body: t('signing.arbitrary_data_view.success_body'),
                type: 'success',
            })
        } catch (error) {
            await request.error?.(`${error}`)
        } finally {
            setIsPending(false)
            removeSignRequest(request)
        }
    }, [request, removeSignRequest, showToast, signArbitraryData, allAccounts])

    const rejectRequest = useCallback(() => {
        removeSignRequest(request)
        if (request.transport === 'callback') {
            request.reject?.()
        }
    }, [request, removeSignRequest])

    return {
        approveRequest,
        rejectRequest,
        isPending,
    }
}
