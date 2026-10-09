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

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Decimal } from 'decimal.js'
import {
    chainAccountOf,
    useAccountAssetBalanceQuery,
    useOnChainAccountStateQuery,
    useSelectedAccount,
    useSignerFor,
    usesNonPrimaryScheme,
    type AssetWithAccountBalance,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useIsNativeAssetId,
    useNativeAsset,
    isCollectible,
    toWholeUnits,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'
import {
    type Maybe,
    type Nullable,
    type Optional,
    displayUnitsToBaseUnits,
    displayUnitsToBaseUnitsBigInt,
    toBigInt,
} from '@perawallet/wallet-core-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { bottomSheetNotifier } from '@components/core'
import { useCapability } from '@hooks/useCapability'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AddNoteContent } from '../../../components/send-funds/AddNoteContent'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useLanguage } from '@hooks/useLanguage'

type useTransactionConfirmationScreenResult = {
    asset: Maybe<PeraAsset>
    amount: Optional<Decimal>
    destination: Optional<string>
    selectedAccount: Nullable<WalletAccount>
    selectedAssetId: Optional<string>
    params: Optional<{ minFee: bigint }>
    paramsPending: boolean
    isQuantumFee: boolean
    currentBalance: Nullable<AssetWithAccountBalance>
    currentBalancePending: boolean
    note: Optional<string>
    openNote: () => void
    handleConfirm: () => void
    isCollectible: boolean
    isReady: boolean
    isCloseAccount: boolean
    isRecipientBelowMbr: boolean
    recipientMbrDisplay: string
    isRecipientInfoPending: boolean
    isSigning: boolean
}

export const useTransactionConfirmationScreen =
    (): useTransactionConfirmationScreenResult => {
        const scope = useSelectedScope(LEGACY_CHAIN_ID)
        const nativeAsset = useNativeAsset()
        const isNativeAssetId = useIsNativeAssetId()
        const navigation =
            useNavigation<StackNavigationProp<SendFundsStackParamList>>()
        const { selectedAssetId, amount, destination, note, isCloseAccount } =
            useSendFunds()
        const { t } = useLanguage()

        const assetIDs = useMemo(
            () => (selectedAssetId ? [selectedAssetId] : []),
            [selectedAssetId],
        )
        const { data: assets } = useAssetsQuery(assetIDs)
        const asset = useMemo(() => {
            if (!selectedAssetId) return null
            return assets.get(selectedAssetId)
        }, [selectedAssetId, assets])

        const selectedAccount = useSelectedAccount()
        const { showToast } = useToast()
        const { request: requestBottomSheet } = useBottomSheet()

        const selectedAddress = selectedAccount
            ? chainAccountOf(selectedAccount, scope.chainId)?.address
            : undefined
        const { minFee, isPending: paramsPending } = useMinFeeForSender(
            selectedAddress,
            scope.chainId,
        )
        const params = minFee !== undefined ? { minFee } : undefined

        // The quantum fee premium is driven by the effective signer (resolving
        // one rekey hop), matching the fee-multiplier logic — not the raw sender.
        // Platform part only: an existing quantum account still pays the
        // premium after remote config switches `quantumAccounts` off.
        const isQuantumEnabled = useCapability({ platform: 'quantum' })
        const signer = useSignerFor(selectedAddress, scope.chainId)
        const isQuantumFee =
            isQuantumEnabled &&
            signer !== null &&
            usesNonPrimaryScheme(signer, scope.chainId)

        const openNote = useCallback(() => {
            void requestBottomSheet({
                contents: <AddNoteContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
        }, [requestBottomSheet])

        const { data: currentBalance, isPending: currentBalancePending } =
            useAccountAssetBalanceQuery(
                selectedAccount ?? undefined,
                selectedAssetId,
                scope,
            )

        const isAlgoSend = isNativeAssetId(selectedAssetId)
        const {
            data: recipientAccountState,
            isPending: recipientAccountInfoPending,
        } = useOnChainAccountStateQuery(
            isAlgoSend ? (destination ?? '') : '',
            scope,
        )
        // Base units of the chain's native asset, as the MBR check below
        // compares base units.
        const recipientAccountInfo = useMemo(
            () =>
                recipientAccountState
                    ? {
                          amount: toBigInt(
                              recipientAccountState.nativeBalanceBaseUnits,
                          ),
                          minBalance: displayUnitsToBaseUnitsBigInt(
                              recipientAccountState.minBalance,
                              nativeAsset.decimals,
                          ),
                      }
                    : undefined,
            [recipientAccountState, nativeAsset.decimals],
        )
        const isRecipientInfoPending =
            isAlgoSend && !!destination && recipientAccountInfoPending

        const { isRecipientBelowMbr, recipientMbrDisplay } = useMemo(() => {
            const mbr = recipientAccountInfo?.minBalance ?? 0n
            const mbrDisplay = toWholeUnits(mbr, nativeAsset).toString()
            if (!isAlgoSend || !amount || !recipientAccountInfo) {
                return {
                    isRecipientBelowMbr: false,
                    recipientMbrDisplay: mbrDisplay,
                }
            }
            const amountBaseUnits = BigInt(
                displayUnitsToBaseUnits(
                    amount,
                    nativeAsset.decimals,
                ).toString(),
            )
            const recipientBalanceAfter =
                recipientAccountInfo.amount + amountBaseUnits
            // The ledger allows leaving a receiver at exactly 0 (a zero-amount
            // note payment to an empty account); only a positive balance below
            // the MBR fails on-chain.
            return {
                isRecipientBelowMbr:
                    recipientBalanceAfter > 0n &&
                    recipientBalanceAfter < recipientAccountInfo.minBalance,
                recipientMbrDisplay: mbrDisplay,
            }
        }, [isAlgoSend, amount, recipientAccountInfo, nativeAsset])

        const [isSigning, setIsSigning] = useState(false)
        const isFocused = useIsFocused()
        // Regaining focus after failed signing resets slide-to-confirm.
        useEffect(() => {
            if (isFocused) {
                setIsSigning(false)
            }
        }, [isFocused])

        const handleConfirm = () => {
            if (isRecipientInfoPending) {
                return
            }

            if (
                !selectedAccount ||
                !selectedAssetId ||
                !destination ||
                !amount ||
                !asset
            ) {
                showToast(
                    {
                        title: t('errors.transaction.title'),
                        body: t('errors.transaction.body'),
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                return
            }

            if (isRecipientBelowMbr) {
                showToast(
                    {
                        title: t(
                            'send_funds.confirmation.recipient_below_mbr.title',
                        ),
                        body: t(
                            'send_funds.confirmation.recipient_below_mbr.body',
                            { min: recipientMbrDisplay },
                        ),
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                return
            }

            setIsSigning(true)
            navigation.navigate('TransactionProcessing')
        }

        const isReady = !!(
            selectedAccount &&
            selectedAssetId &&
            amount &&
            asset
        )

        const isCollectibleAsset = asset ? isCollectible(asset) : false

        return {
            asset,
            amount,
            destination,
            selectedAccount,
            selectedAssetId,
            params,
            paramsPending,
            isQuantumFee,
            currentBalance,
            currentBalancePending,
            note,
            openNote,
            handleConfirm,
            isCollectible: isCollectibleAsset,
            isReady,
            isCloseAccount,
            isRecipientBelowMbr,
            recipientMbrDisplay,
            isRecipientInfoPending,
            isSigning,
        }
    }
