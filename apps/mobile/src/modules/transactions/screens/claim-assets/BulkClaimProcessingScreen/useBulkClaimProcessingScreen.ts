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

import { useCallback, useEffect, useState } from 'react'
import { BackHandler } from 'react-native'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import {
    useAccountBalancesInvalidator,
    useFindAccountByAddress,
} from '@perawallet/wallet-core-accounts'
import { useInboxInvalidator } from '@perawallet/wallet-core-messages'
import {
    useAssetInboxBatchResolution,
    type AssetInboxBatchItemStatus,
} from '@perawallet/wallet-core-transactions'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useTransactionOutcomeHaptics } from '@hooks/useTransactionOutcomeHaptics'
import type { MessagesStackParamList } from '@modules/messages'
import { useClaimAssets } from '@modules/transactions/hooks'

export type BulkClaimItem = {
    key: string
    name: string
    status: AssetInboxBatchItemStatus
}

export type UseBulkClaimProcessingScreenResult = {
    items: BulkClaimItem[]
    title: string
    subtitle: string
    /** The batch ended with failures; the screen stays so they can be read. */
    hasFailed: boolean
    statusLabel: (status: AssetInboxBatchItemStatus) => string
    handleDone: () => void
}

export const useBulkClaimProcessingScreen =
    (): UseBulkClaimProcessingScreenResult => {
        const navigation = useNavigation()
        const { mode, assetIndexes, scope } =
            useRoute<RouteProp<MessagesStackParamList, 'BulkClaimProcessing'>>()
                .params
        const { t } = useLanguage()
        const { showToast } = useToast()
        const { showError } = useErrorToast()
        const { handleSubmitError } = useTransactionOutcomeHaptics()
        const { assetRequests, accountAddress } = useClaimAssets()
        const account = useFindAccountByAddress(accountAddress ?? '', scope)
        const { resolve } = useAssetInboxBatchResolution(scope)
        const { invalidate: invalidateInboxQueries } = useInboxInvalidator()
        const { invalidate: invalidateAccountBalances } =
            useAccountBalancesInvalidator()

        const [requests] = useState(() =>
            assetIndexes.flatMap(index => {
                const request = assetRequests[index]
                return request ? [request] : []
            }),
        )
        const [items, setItems] = useState<BulkClaimItem[]>(() =>
            requests.map((request, position) => ({
                key: `${request.asset.assetId}-${position}`,
                name: request.asset.name ?? request.asset.unitName ?? '',
                status: 'waiting',
            })),
        )
        const [isFinished, setIsFinished] = useState(false)

        useEffect(() => {
            // The batch leaves on its own, or through Done when something failed.
            const subscription = BackHandler.addEventListener(
                'hardwareBackPress',
                () => true,
            )

            // The screen was opened with stale or missing state; nothing to send.
            if (!account || requests.length !== assetIndexes.length) {
                navigation.goBack()
                return () => subscription.remove()
            }

            const onStatus = (
                position: number,
                status: AssetInboxBatchItemStatus,
            ) =>
                setItems(current =>
                    current.map((item, index) =>
                        index === position ? { ...item, status } : item,
                    ),
                )

            const run = async () => {
                try {
                    const { doneCount, failedCount, firstError } =
                        await resolve({
                            mode,
                            sender: account,
                            requests,
                            onStatus,
                        })
                    // Only one toast shows at a time; on failure the screen lists what went through.
                    if (doneCount > 0 && failedCount === 0) {
                        showToast({
                            title:
                                mode === 'claim'
                                    ? t(
                                          'asset_inbox.requests.bulk_claimed_toast',
                                          { count: doneCount },
                                      )
                                    : t(
                                          'asset_inbox.requests.bulk_rejected_toast',
                                          { count: doneCount },
                                      ),
                            body: '',
                            type: 'success',
                        })
                    }
                    if (failedCount > 0) {
                        handleSubmitError(firstError)
                        showError(
                            firstError,
                            t('asset_inbox.bulk.failed_title', {
                                count: failedCount,
                            }),
                        )
                        setIsFinished(true)
                        return
                    }
                    navigation.goBack()
                } catch (error) {
                    // The batch catches each request's failure, so this is
                    // unexpected; leaving beats a spinner with back disabled.
                    showError(error)
                    navigation.goBack()
                } finally {
                    invalidateInboxQueries()
                    invalidateAccountBalances()
                }
            }

            void run()

            return () => subscription.remove()
            // Runs the batch exactly once on mount; re-running would send it again.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        const handleDone = useCallback(() => {
            if (isFinished) navigation.goBack()
        }, [isFinished, navigation])

        const statusLabel = useCallback(
            (status: AssetInboxBatchItemStatus): string => {
                if (status === 'done') {
                    return mode === 'claim'
                        ? t('asset_inbox.bulk.status_claimed')
                        : t('asset_inbox.bulk.status_rejected')
                }
                if (status === 'sending') {
                    return t('asset_inbox.bulk.status_sending')
                }
                if (status === 'failed')
                    return t('asset_inbox.bulk.status_failed')
                if (status === 'cancelled') {
                    return t('asset_inbox.bulk.status_cancelled')
                }
                return t('asset_inbox.bulk.status_waiting')
            },
            [mode, t],
        )

        const settledCount = items.filter(
            item => item.status !== 'waiting' && item.status !== 'sending',
        ).length
        const failedCount = items.filter(
            item => item.status === 'failed',
        ).length
        const progress = {
            current: Math.min(settledCount + 1, items.length),
            total: items.length,
        }
        const isShowingFailures = isFinished && failedCount > 0

        const runningTitle =
            mode === 'claim'
                ? t('asset_inbox.bulk.claiming_title', progress)
                : t('asset_inbox.bulk.rejecting_title', progress)

        return {
            items,
            title: isShowingFailures
                ? t('asset_inbox.bulk.failed_title', { count: failedCount })
                : runningTitle,
            subtitle: isShowingFailures
                ? t('asset_inbox.bulk.failed_subtitle')
                : t('asset_inbox.bulk.subtitle'),
            hasFailed: isShowingFailures,
            statusLabel,
            handleDone,
        }
    }
