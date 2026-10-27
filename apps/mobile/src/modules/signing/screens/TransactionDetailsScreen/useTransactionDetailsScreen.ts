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

import { useCallback, useEffect, useMemo } from 'react'

import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import {
    chainAccountOf,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    type ChainScope,
    type TransactionNative,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    getNetworkErrorMessageKeys,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    summarizeHistoryItem,
    type SuspectedPoisoning,
} from '@perawallet/wallet-core-transactions'
import {
    trackScreen,
    AnalyticsScreenName,
    AnalyticsMetadataKey,
} from '@analytics'
import type { AddressReuseGuard } from '@components/AddressReuseGuard'
import { chainNoticeOf, type ChainNoticeContent } from '@components/ChainNotice'
import { chainUiFor } from '@modules/chain-ui'
import { useNetworkStatus, useNetworkStatusStore } from '@modules/network'
import type { SigningStackParamList } from '@modules/signing/routes'
import { useSuspectedAddressReuseGuard } from '@modules/transactions'
import { useNoTransactionDetail } from './useNoTransactionDetail'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'TransactionDetails'
>

type TransactionDetailsRouteProp = RouteProp<
    SigningStackParamList,
    'TransactionDetails'
>

type TransactionDetailsRenderState =
    | { kind: 'content'; transaction: TransactionNative }
    | { kind: 'loading' }
    | { kind: 'offline' }
    | { kind: 'error'; titleKey: I18nKey; bodyKey: I18nKey }

type UseTransactionDetailsScreenResult = {
    renderState: TransactionDetailsRenderState
    scope: ChainScope
    groupId?: string
    isExternal: boolean
    /** Only a history row carries a status, so a signing-flow transaction has none. */
    notice: Nullable<ChainNoticeContent>
    suspectedPoisoning: Optional<SuspectedPoisoning>
    addressReuseGuard: AddressReuseGuard
    handleRelatedTransactionPress: (related: TransactionNative) => void
    handleRetry: () => void
}

export const useTransactionDetailsScreen =
    (): UseTransactionDetailsScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const route = useRoute<TransactionDetailsRouteProp>()

        const {
            scope,
            transaction: paramTransaction,
            transactionId,
            groupId,
            isExternal,
            historyTransaction,
            suspectedPoisoning,
        } = route.params
        const addressReuseGuard = useSuspectedAddressReuseGuard({
            suspectedPoisoning,
            scope,
        })

        // Tracked in-screen rather than via the navigator's screenListeners: this
        // screen is also mounted inside the signing flow's own NavigationContainer
        // (SignRequestView), which has no screenListeners, so a centralized listener
        // would miss that path.
        useEffect(() => {
            trackScreen(AnalyticsScreenName.TransactionDetail, {
                [AnalyticsMetadataKey.ChainId]: scope.chainId,
            })
        }, [scope.chainId])

        // A route's scope never changes, so this resolves to the same hook on every render.
        const chainUseTransactionDetail = chainUiFor(
            getChainDescriptor(scope.chainId).family,
        ).transactionDetails?.useTransactionDetail
        const useTransactionDetail =
            chainUseTransactionDetail ?? useNoTransactionDetail
        const canFetchDetail = !!chainUseTransactionDetail
        const detail = useTransactionDetail({
            scope,
            transactionId: transactionId ?? '',
            historyTransaction,
            isEnabled: !paramTransaction && !!transactionId,
        })

        const { hasInternet } = useNetworkStatus()
        // The signing flow's in-memory object is authoritative (unsigned txns
        // have no on-chain id).
        const transaction = paramTransaction ?? detail.transaction

        const account = useSelectedAccount()
        const address = account
            ? (chainAccountOf(account, scope.chainId)?.address ?? '')
            : ''
        const notice = useMemo(
            () =>
                historyTransaction
                    ? chainNoticeOf(
                          summarizeHistoryItem(
                              historyTransaction,
                              address,
                              scope.chainId,
                          ).notice,
                      )
                    : null,
            [historyTransaction, address, scope.chainId],
        )

        const renderState = useMemo((): TransactionDetailsRenderState => {
            if (transaction) {
                return { kind: 'content', transaction }
            }
            // Offline wins over a stale error: a device that goes offline
            // carrying a prior error (e.g. `timeout`) must show the offline
            // surface, not a dead Retry that just re-pauses. Mirrors the
            // charts contract (`isPaused || (isError && !online)`).
            if (detail.isPaused || (detail.isError && !hasInternet)) {
                return { kind: 'offline' }
            }
            if (detail.isError) {
                const { titleKey, bodyKey } = getNetworkErrorMessageKeys(
                    detail.error,
                )
                return { kind: 'error', titleKey, bodyKey }
            }
            if (detail.isLoading) {
                return { kind: 'loading' }
            }
            if (!canFetchDetail) {
                return {
                    kind: 'error',
                    titleKey: i18nKey('transactions.unknown.title'),
                    bodyKey: i18nKey('transactions.unknown.body'),
                }
            }
            const { titleKey, bodyKey } = getNetworkErrorMessageKeys(undefined)
            return { kind: 'error', titleKey, bodyKey }
        }, [
            transaction,
            detail.isError,
            detail.error,
            detail.isPaused,
            detail.isLoading,
            hasInternet,
            canFetchDetail,
        ])

        const handleRelatedTransactionPress = useCallback(
            (related: TransactionNative) => {
                navigation.push('TransactionDetails', {
                    scope,
                    transaction: related,
                    groupId,
                })
            },
            [navigation, scope, groupId],
        )

        const handleRetry = useCallback(() => {
            // Offline: skip the doomed request (30 s timeout) — the offline
            // copy on screen already promises a refresh on reconnect. Matches
            // the charts retry so both offline surfaces behave alike.
            if (!useNetworkStatusStore.getState().hasInternet) {
                return
            }
            void detail.refetch()
        }, [detail])

        return {
            renderState,
            scope,
            groupId,
            isExternal: isExternal ?? false,
            notice,
            suspectedPoisoning,
            addressReuseGuard,
            handleRelatedTransactionPress,
            handleRetry,
        }
    }
