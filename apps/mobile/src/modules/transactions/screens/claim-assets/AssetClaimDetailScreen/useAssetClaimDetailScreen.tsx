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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'
import {
    findAccountByAddressOn,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useClipboard } from '@hooks/useClipboard'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useClaimAssets } from '@modules/transactions/hooks'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import type { MessagesStackParamList } from '@modules/messages'
import { Decimal } from 'decimal.js'
import { useCanFundAccount } from '@modules/onramp'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    formatAssetAmount,
    useNativeAsset,
    toWholeUnits,
} from '@perawallet/wallet-core-assets'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseAssetClaimDetailScreenResult = {
    request: Nullable<AssetInboxRequest>
    /** The chain the claimed asset is on. */
    chainId: ChainId
    receiverAccount: Nullable<WalletAccount>
    amount: Decimal
    /** The native asset's ticker, for the insufficient-funds copy. */
    nativeSymbol: string
    /** Formatted native amount credited on claim, or null when there is none. */
    claimGainLabel: Nullable<string>
    isClaimBlocked: boolean
    isRejectBlocked: boolean
    handleClaim: () => void
    handleRejectPress: () => void
    canBuy: boolean
    handleAddFunds: () => void
    handleCopyAssetId: () => void
}

export const useAssetClaimDetailScreen =
    (): UseAssetClaimDetailScreenResult => {
        const { push, navigate } = useAppNavigation()
        const route =
            useRoute<RouteProp<MessagesStackParamList, 'AssetClaimDetail'>>()
        const { assetIndex, scope } = route.params
        const nativeAsset = useNativeAsset(scope)
        const nativeSymbol = nativeAsset.unitName ?? ''
        const { assetRequests, accountAddress } = useClaimAssets()
        const accounts = useAllAccounts()
        const { copyToClipboard } = useClipboard()
        const { request: requestBottomSheet } = useBottomSheet()
        const { errorToast } = useToast()
        const { t } = useLanguage()

        const request = assetRequests[assetIndex] ?? null
        const account = accountAddress
            ? findAccountByAddressOn(accounts, scope.chainId, accountAddress)
            : undefined
        const canBuy = useCanFundAccount(account)

        // The opt-in this claim performs raises the account's minimum balance,
        // so a claim the backend says is unaffordable can only be unblocked by
        // adding native funds — unless the inbox itself carries enough to cover it.
        const isClaimBlocked =
            !!request?.insufficientNativeForClaiming &&
            !request.shouldUseFundsBeforeClaiming

        // Rejecting only pays a fee, so it can be affordable when claiming is
        // not; the two are stated separately rather than as one "no funds".
        const isRejectBlocked =
            !!request?.insufficientNativeForRejecting &&
            !request.shouldUseFundsBeforeRejecting

        const handleAddFunds = useCallback(() => {
            navigate('TabBar', { screen: 'Fund' })
        }, [navigate])

        const handleClaim = useCallback(() => {
            if (isClaimBlocked) {
                errorToast(
                    t('errors.transaction.title'),
                    t('messages.claim.insufficient_native_claim', {
                        symbol: nativeSymbol,
                    }),
                )
                return
            }

            push('Messages', {
                screen: 'ClaimProcessing',
                params: {
                    mode: 'claim',
                    assetIndex,
                    shouldClaimAlgo:
                        request?.shouldUseFundsBeforeClaiming ?? false,
                    scope,
                },
            })
        }, [
            push,
            assetIndex,
            request,
            t,
            errorToast,
            isClaimBlocked,
            nativeSymbol,
            scope,
        ])

        const handleRejectPress = useCallback(async () => {
            if (!request) return

            if (isRejectBlocked) {
                errorToast(
                    t('errors.transaction.title'),
                    t('messages.claim.insufficient_native_reject', {
                        symbol: nativeSymbol,
                    }),
                )
                return
            }

            const rejectGainLabel = formatAssetAmount(
                request.nativeGainOnReject,
                nativeAsset,
            )

            const confirmed = await requestBottomSheet<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='warning'
                        iconVariant='error'
                        title={t('messages.claim.reject_title')}
                        message={t('messages.claim.reject_gain_body', {
                            amount: rejectGainLabel,
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
                    mode: 'reject',
                    assetIndex,
                    shouldClaimAlgo:
                        request.shouldUseFundsBeforeRejecting ?? false,
                    scope,
                },
            })
        }, [
            push,
            assetIndex,
            request,
            requestBottomSheet,
            t,
            errorToast,
            isRejectBlocked,
            nativeAsset,
            nativeSymbol,
            scope,
        ])

        const handleCopyAssetId = useCallback(() => {
            if (request.id) {
                void copyToClipboard(String(request.id))
            }
        }, [request, copyToClipboard])

        const amount = useMemo(() => {
            if (!request) return new Decimal(0)
            return toWholeUnits(request.totalAmount, request.asset)
        }, [request])

        const claimGainLabel = useMemo(() => {
            if (!request || request.nativeGainOnClaim.isZero()) return null
            return formatAssetAmount(request.nativeGainOnClaim, nativeAsset)
        }, [request, nativeAsset])

        return {
            request,
            chainId: scope.chainId,
            amount,
            nativeSymbol,
            claimGainLabel,
            receiverAccount: account ?? null,
            isClaimBlocked,
            isRejectBlocked,
            handleClaim,
            canBuy,
            handleAddFunds,
            handleRejectPress: () => void handleRejectPress(),
            handleCopyAssetId,
        }
    }
