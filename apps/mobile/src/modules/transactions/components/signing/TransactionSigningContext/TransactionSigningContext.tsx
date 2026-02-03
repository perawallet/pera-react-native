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
    createContext,
    useContext,
    useMemo,
    useState,
    useCallback,
} from 'react'
import {
    type TransactionSignRequest,
    type PeraDisplayableTransaction,
    mapToDisplayableTransaction,
    encodeAlgorandAddress,
    useAlgorandClient,
    useSigningRequest,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    useTransactionSigner,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { bottomSheetNotifier } from '@components/core'
import { TransactionSigningContextValue } from '@modules/transactions/models'

export type AggregatedWarning = {
    type: 'close' | 'rekey'
    senderAddress: string
    targetAddress: string
}

export const TransactionSigningContext = createContext<TransactionSigningContextValue | null>(null)

export type TransactionSigningContextProviderProps = {
    request: TransactionSignRequest
    children: React.ReactNode
}

export const SigningContextProvider = ({
    request,
    children,
}: TransactionSigningContextProviderProps) => {
    const { removeSignRequest } = useSigningRequest()
    const { signTransactions } = useTransactionSigner()
    const { encodeSignedTransactions } = useTransactionEncoder()
    const algokit = useAlgorandClient()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const [isLoading, setIsLoading] = useState(false)
    const accounts = useAllAccounts()

    const groups = useMemo(
        () =>
            request.txs.map(group =>
                group
                    .map(tx => mapToDisplayableTransaction(tx))
                    .filter((tx): tx is PeraDisplayableTransaction => !!tx),
            ),
        [request.txs],
    )

    const allTransactions = useMemo(() => groups.flat(), [groups])

    const totalFee = useMemo(() => {
        return allTransactions.reduce((sum, tx) => sum + (tx.fee ?? 0n), 0n)
    }, [allTransactions])

    // Get addresses of accounts the user can sign for
    const signableAddresses = useMemo(
        () => new Set(accounts.filter(a => a.canSign).map(a => a.address)),
        [accounts],
    )

    // Aggregate warnings across all transactions for user-controlled accounts
    const aggregatedWarnings = useMemo(() => {
        const warnings: AggregatedWarning[] = []

        for (const tx of allTransactions) {
            // Only show warnings for transactions the user is signing
            if (!tx.sender || !signableAddresses.has(tx.sender)) {
                continue
            }

            // Check for close-to warnings
            const closeAddress =
                tx.paymentTransaction?.closeRemainderTo ??
                tx.assetTransferTransaction?.closeTo

            if (closeAddress) {
                warnings.push({
                    type: 'close',
                    senderAddress: tx.sender,
                    targetAddress: closeAddress,
                })
            }

            // Check for rekey warnings
            if (tx.rekeyTo?.publicKey) {
                const rekeyAddress = encodeAlgorandAddress(tx.rekeyTo.publicKey)
                warnings.push({
                    type: 'rekey',
                    senderAddress: tx.sender,
                    targetAddress: rekeyAddress,
                })
            }
        }

        return warnings
    }, [allTransactions, signableAddresses])

    const isSingleTransaction = groups.length === 1 && groups[0]?.length === 1
    const isSingleGroup = groups.length === 1 && !isSingleTransaction
    const isMultipleGroups = groups.length > 1

    const signAndSend = useCallback(async () => {
        setIsLoading(true)
        try {
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
                showToast({
                    title: t('signing.transaction_view.success_title'),
                    body: t('signing.transaction_view.success_body'),
                    type: 'success',
                })
            }
            removeSignRequest(request)
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
    }, [
        request,
        signTransactions,
        algokit,
        encodeSignedTransactions,
        showToast,
        t,
        removeSignRequest,
    ])

    const rejectRequest = useCallback(() => {
        if (request.transport === 'callback') {
            request.reject?.()
        }
        removeSignRequest(request)
    }, [request, removeSignRequest])

    const value = useMemo(
        () => ({
            request,
            groups,
            allTransactions,
            totalFee,
            isSingleTransaction,
            isSingleGroup,
            isMultipleGroups,
            isLoading,
            aggregatedWarnings,
            signAndSend,
            rejectRequest,
        }),
        [
            request,
            groups,
            allTransactions,
            totalFee,
            isSingleTransaction,
            isSingleGroup,
            isMultipleGroups,
            isLoading,
            aggregatedWarnings,
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
