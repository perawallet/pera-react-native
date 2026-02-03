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

import { createContext, useMemo, useState, useCallback } from 'react'
import {
    useSigningRequestAnalysis,
    useSigningRequest,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import { config } from '@perawallet/wallet-core-config'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { bottomSheetNotifier } from '@components/core'
import { TransactionSigningContextValue } from '@modules/transactions/models'

export const TransactionSigningContext =
    createContext<TransactionSigningContextValue | null>(null)

export type SigningContextProviderProps = {
    request: TransactionSignRequest
    children: React.ReactNode
}

export const SigningContextProvider = ({
    request,
    children,
}: SigningContextProviderProps) => {
    const { showToast } = useToast()
    const { t } = useLanguage()
    const [isLoading, setIsLoading] = useState(false)

    const { groups, allTransactions, totalFee, warnings, requestStructure } =
        useSigningRequestAnalysis(request)

    const { signAndSendRequest, rejectRequest: coreRejectRequest } =
        useSigningRequest()

    const signAndSend = useCallback(async () => {
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

    const rejectRequest = useCallback(() => {
        coreRejectRequest(request)
    }, [request, coreRejectRequest])

    const value = useMemo(
        () => ({
            request,
            groups,
            allTransactions,
            totalFee,
            requestStructure,
            isLoading,
            warnings,
            signAndSend,
            rejectRequest,
        }),
        [
            request,
            groups,
            allTransactions,
            totalFee,
            requestStructure,
            isLoading,
            warnings,
            signAndSend,
            rejectRequest,
        ],
    )

    return (
        <TransactionSigningContext.Provider value={value}>
            {children}
        </TransactionSigningContext.Provider>
    )
}
