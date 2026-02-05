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

import { useCallback, useState } from 'react'
import { useToast } from '@hooks/useToast'
import { config } from '@perawallet/wallet-core-config'
import { useLanguage } from '@hooks/useLanguage'
import {
    TransactionSignRequest,
    useSigningRequest,
    useSigningRequestAnalysis,
} from '@perawallet/wallet-core-signing'
import { bottomSheetNotifier } from '@components/core'

export const useSigningActionButtons = () => {
    const { showToast } = useToast()
    const { t } = useLanguage()
    const [isLoading, setIsLoading] = useState(false)

    const { currentRequest, signAndSendRequest, rejectRequest } =
        useSigningRequest()
    const request = currentRequest as TransactionSignRequest
    const { allTransactions } = useSigningRequestAnalysis(request)

    const handleSignAndSend = useCallback(async () => {
        if (!request) {
            return
        }
        setIsLoading(true)
        try {
            await signAndSendRequest(request)
            if (request.transport !== 'algod') {
                showToast({
                    title: t('signing.transaction_view.success_title'),
                    body: t('signing.transaction_view.success_body'),
                    type: 'success',
                })
            }
        } catch (error) {
            if (request.transport === 'algod') {
                showToast(
                    {
                        type: 'error',
                        title: t(
                            'signing.transaction_view.transaction_failed_title',
                        ),
                        body: config.debugEnabled
                            ? `${error}`
                            : t(
                                  'signing.transaction_view.transaction_failed_body',
                              ),
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            } else {
                request.error?.(`${error}`)
            }
        } finally {
            setIsLoading(false)
        }
    }, [request, signAndSendRequest, showToast, t])

    const handleReject = useCallback(() => {
        if (!request) {
            return
        }
        rejectRequest(request)
    }, [request, rejectRequest])

    return {
        handleSignAndSend,
        handleReject,
        isLoading,
        hasMultipleTransactions: allTransactions.length > 1,
    }
}
