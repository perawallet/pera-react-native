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

import { useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { Arc59AssetRequest } from '@perawallet/wallet-core-asa-inbox'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useClipboard } from '@hooks/useClipboard'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useClaimAssets } from '@modules/transactions/hooks'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import type { MessagesStackParamList } from '@modules/messages/routes/types'
import { Decimal } from 'decimal.js'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { ALGO_ASSET, toWholeUnits } from '@perawallet/wallet-core-assets'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import {
    ALGO_ASSET_NAME,
    DEFAULT_PRECISION,
    formatCurrency,
    type Nullable,
} from '@perawallet/wallet-core-shared'

type UseAssetClaimDetailScreenResult = {
    request: Nullable<Arc59AssetRequest>
    receiverAccount: Nullable<WalletAccount>
    amount: Decimal
    handleClaim: () => void
    handleRejectPress: () => void
    handleCopyAssetId: () => void
}

export const useAssetClaimDetailScreen =
    (): UseAssetClaimDetailScreenResult => {
        const { push } = useAppNavigation()
        const route =
            useRoute<RouteProp<MessagesStackParamList, 'AssetClaimDetail'>>()
        const { assetIndex } = route.params
        const { assetRequests, accountAddress } = useClaimAssets()
        const accounts = useAllAccounts()
        const { copyToClipboard } = useClipboard()
        const { request: requestBottomSheet } = useBottomSheet()
        const { showToast, errorToast } = useToast()
        const { t } = useLanguage()

        const request = assetRequests[assetIndex] ?? null
        const account = accounts.find(acc => acc.address === accountAddress)

        const handleClaim = useCallback(() => {
            if (
                request?.insufficientAlgoForClaiming &&
                !request?.shouldUseFundsBeforeClaiming
            ) {
                showToast({
                    title: t('errors.transaction.title'),
                    body: t('messages.claim.insufficient_algo_claim'),
                    type: 'error',
                })
                return
            }

            push('Messages', {
                screen: 'ClaimProcessing',
                params: {
                    mode: 'claimArc59',
                    assetIndex,
                    shouldClaimAlgo:
                        request?.shouldUseFundsBeforeClaiming ?? false,
                },
            })
        }, [push, assetIndex, request, showToast, t])

        const handleRejectPress = useCallback(async () => {
            if (!request) return

            if (
                request.insufficientAlgoForRejecting &&
                !request.shouldUseFundsBeforeRejecting
            ) {
                errorToast(
                    t('errors.transaction.title'),
                    t('messages.claim.insufficient_algo_reject'),
                )
                return
            }

            const algoDisplayAmount = formatCurrency(
                baseUnitsToDisplayUnits(
                    request.microAlgoGainOnReject,
                    ALGO_ASSET.decimals,
                ),
                ALGO_ASSET.decimals,
                ALGO_ASSET_NAME,
                undefined,
                false,
                false,
                DEFAULT_PRECISION,
            )

            const confirmed = await requestBottomSheet<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='warning'
                        iconVariant='error'
                        title={t('messages.claim.reject_title')}
                        message={t('messages.claim.reject_body', {
                            algoAmount: algoDisplayAmount,
                        })}
                        confirmLabel={t('messages.claim.reject')}
                        cancelLabel={t('messages.claim.reject_cancel')}
                        buttonPaddingStyle='dense'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })

            if (!confirmed) return

            push('Messages', {
                screen: 'ClaimProcessing',
                params: {
                    mode: 'rejectArc59',
                    assetIndex,
                    shouldClaimAlgo:
                        request.shouldUseFundsBeforeRejecting ?? false,
                },
            })
        }, [push, assetIndex, request, requestBottomSheet, t, errorToast])

        const handleCopyAssetId = useCallback(() => {
            if (request.id) {
                void copyToClipboard(String(request.id))
            }
        }, [request, copyToClipboard])

        const amount = useMemo(() => {
            if (!request) return new Decimal(0)
            return toWholeUnits(request.totalAmount, request.asset)
        }, [request])

        return {
            request,
            amount,
            receiverAccount: account ?? null,
            handleClaim,
            handleRejectPress: () => void handleRejectPress(),
            handleCopyAssetId,
        }
    }
