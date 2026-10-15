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
import { Decimal } from 'decimal.js'
import {
    chainAccountOf,
    useAccountAssetBalanceQuery,
    useSelectedAccount,
    useSignerFor,
    usesNonPrimaryScheme,
    type AssetWithAccountBalance,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isCollectible,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'
import {
    type Maybe,
    type Nullable,
    type Optional,
    displayUnitsToBaseUnits,
} from '@perawallet/wallet-core-shared'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
    type FeePreset,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    useRecipientWarningQuery,
    type ChainNotice,
} from '@perawallet/wallet-core-transactions'
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
    chainId: ChainId
    /** Base units of the chain's native asset. */
    feeAmount: Optional<Decimal>
    isFeePending: boolean
    feePreset: FeePreset
    setFeePreset: (preset: FeePreset) => void
    isQuantumFee: boolean
    currentBalance: Nullable<AssetWithAccountBalance>
    currentBalancePending: boolean
    note: Optional<string>
    openNote: () => void
    handleConfirm: () => void
    isCollectible: boolean
    isReady: boolean
    isCloseAccount: boolean
    recipientWarning: Optional<ChainNotice>
    isRecipientInfoPending: boolean
    isSigning: boolean
}

export const useTransactionConfirmationScreen =
    (): useTransactionConfirmationScreenResult => {
        const scope = useSelectedScope(LEGACY_CHAIN_ID)
        const navigation =
            useNavigation<StackNavigationProp<SendFundsStackParamList>>()
        const {
            selectedAssetId,
            amount,
            destination,
            note,
            isCloseAccount,
            feePreset,
            setFeePreset,
        } = useSendFunds()
        const { t } = useLanguage()

        const assetIDs = useMemo(
            () => (selectedAssetId ? [selectedAssetId] : []),
            [selectedAssetId],
        )
        const { data: assets } = useAssetsQuery(scope, assetIDs)
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
        const { minFee, isPending: isFeePending } = useMinFeeForSender(
            selectedAddress,
            scope.chainId,
        )
        const feeAmount = useMemo(
            () =>
                minFee !== undefined
                    ? new Decimal(minFee.toString())
                    : undefined,
            [minFee],
        )

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

        const recipientInput = useMemo(
            () =>
                destination && amount && asset && selectedAssetId
                    ? {
                          recipient: destination,
                          asset: {
                              chainId: scope.chainId,
                              assetId: selectedAssetId,
                          },
                          amount: displayUnitsToBaseUnits(
                              amount,
                              asset.decimals,
                          ),
                          scope,
                      }
                    : undefined,
            [destination, amount, asset, selectedAssetId, scope],
        )
        const { data: recipientWarning, isPending: isRecipientInfoPending } =
            useRecipientWarningQuery(recipientInput)

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

            if (recipientWarning) {
                showToast(
                    {
                        title: t(
                            recipientWarning.title.key,
                            recipientWarning.title.params,
                        ),
                        body: recipientWarning.body
                            .map(paragraph =>
                                t(paragraph.key, paragraph.params),
                            )
                            .join(' '),
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
            chainId: scope.chainId,
            feeAmount,
            isFeePending,
            feePreset,
            setFeePreset,
            isQuantumFee,
            currentBalance,
            currentBalancePending,
            note,
            openNote,
            handleConfirm,
            isCollectible: isCollectibleAsset,
            isReady,
            isCloseAccount,
            recipientWarning,
            isRecipientInfoPending,
            isSigning,
        }
    }
