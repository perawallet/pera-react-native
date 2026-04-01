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

import { useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { Arc59AssetRequest } from '@perawallet/wallet-core-asa-inbox'
import { useAllAccounts, WalletAccount } from '@perawallet/wallet-core-accounts'
import { useClipboard } from '@hooks/useClipboard'
import { useClaimAssets } from '@modules/transactions/hooks'
import type { MessagesStackParamList } from '@modules/messages/routes/types'
import { Decimal } from 'decimal.js'
import { useModalState } from '@hooks/useModalState'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { toWholeUnits } from '@perawallet/wallet-core-assets'

type UseAssetClaimDetailScreenResult = {
    request: Arc59AssetRequest | null
    receiverAccount: WalletAccount | null
    isRejectSheetOpen: boolean
    amount: Decimal
    handleClaim: () => void
    handleRejectPress: () => void
    handleRejectConfirm: () => void
    handleRejectClose: () => void
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
        const rejectModal = useModalState()
        const { showToast } = useToast()
        const { t } = useLanguage()

        const request = assetRequests[assetIndex] ?? null
        const account = accounts.find(acc => acc.address === accountAddress)

        const handleClaim = useCallback(() => {
            if (request?.insufficientAlgoForClaiming) {
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

        const handleRejectPress = useCallback(() => {
            rejectModal.open()
        }, [])

        const handleRejectConfirm = useCallback(() => {
            if (request?.insufficientAlgoForRejecting) {
                rejectModal.close()
                showToast({
                    title: t('errors.transaction.title'),
                    body: t('messages.claim.insufficient_algo_reject'),
                    type: 'error',
                })
                return
            }

            rejectModal.close()
            push('Messages', {
                screen: 'ClaimProcessing',
                params: {
                    mode: 'rejectArc59',
                    assetIndex,
                    shouldClaimAlgo:
                        request?.shouldUseFundsBeforeRejecting ?? false,
                },
            })
        }, [push, assetIndex, request, rejectModal, showToast, t])

        const handleRejectClose = useCallback(() => {
            rejectModal.close()
        }, [])

        const handleCopyAssetId = useCallback(() => {
            if (request.id) {
                copyToClipboard(String(request.id))
            }
        }, [request, copyToClipboard])

        const amount = useMemo(() => {
            if (!request) return Decimal(0)
            return toWholeUnits(request.totalAmount, request.asset)
        }, [request])

        return {
            request,
            amount,
            receiverAccount: account ?? null,
            isRejectSheetOpen: rejectModal.isOpen,
            handleClaim,
            handleRejectPress,
            handleRejectConfirm,
            handleRejectClose,
            handleCopyAssetId,
        }
    }
