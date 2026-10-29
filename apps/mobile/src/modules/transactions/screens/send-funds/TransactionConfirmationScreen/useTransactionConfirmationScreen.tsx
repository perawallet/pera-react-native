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

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ComponentType,
} from 'react'
import type { Decimal } from 'decimal.js'
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
    toWholeUnits,
    useAssetsQuery,
    useIsNativeAssetId,
    useNativeAsset,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    type Maybe,
    type Nullable,
    type Optional,
    displayUnitsToBaseUnits,
    formatCurrency,
    ZERO_DECIMAL,
} from '@perawallet/wallet-core-shared'
import type {
    ChainScope,
    FeeEstimate,
    FeePreset,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    sendFlowChainAdapters,
    useRecipientWarningQuery,
    useSendFeeQuery,
    useSpendableBalanceQuery,
    type ChainNotice,
} from '@perawallet/wallet-core-transactions'
import { bottomSheetNotifier } from '@components/core'
import { resolvePrecision } from '@components/CurrencyAmount'
import type { FeeRowProps } from '@components/FeeRow'
import { useCapability } from '@hooks/useCapability'
import { useChainNameWhenMultiChain } from '@hooks/useChainNameWhenMultiChain'
import { useToast } from '@hooks/useToast'
import {
    useRecipientSafety,
    useSendFunds,
    useSendScope,
    type UseRecipientSafetyResult,
} from '@modules/transactions/hooks'
import { useBottomSheet } from '@modules/bottom-sheet'
import { chainUiFor } from '@modules/chain-ui'
import type { SendTrailingSectionProps } from '@modules/transactions/types/send-confirmation-display'
import { AddNoteContent } from '@modules/transactions/components/send-funds/AddNoteContent'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '@modules/transactions/routes/send-funds/types'
import { useLanguage } from '@hooks/useLanguage'
import { NeutralSendFeeSection } from './NeutralSendFeeSection'
import { useSendTotal, type UseSendTotalResult } from './useSendTotal'

type useTransactionConfirmationScreenResult = {
    asset: Maybe<PeraAsset>
    amount: Optional<Decimal>
    destination: Optional<string>
    selectedAccount: Nullable<WalletAccount>
    selectedAssetId: Optional<string>
    scope: ChainScope
    /** Set when the wallet spans chains, so the review says which network this send is on. */
    networkName: Optional<string>
    /** Base units of the chain's native asset. */
    feeAmount: Optional<Decimal>
    feePresets: FeeEstimate['presets']
    isFeePending: boolean
    feePreset: FeePreset
    setFeePreset: (preset: FeePreset) => void
    isQuantumFee: boolean
    currentBalance: Nullable<AssetWithAccountBalance>
    currentBalancePending: boolean
    note: Optional<string>
    FeeSection: ComponentType<FeeRowProps>
    TrailingSection: Optional<ComponentType<SendTrailingSectionProps>>
    openNote: () => void
    handleConfirm: () => void
    isCollectible: boolean
    isReady: boolean
    isCloseAccount: boolean
    recipientWarning: Optional<ChainNotice>
    isRecipientInfoPending: boolean
    recipientSafety: UseRecipientSafetyResult
    isSigning: boolean
    /** The amount plus its fee; set on a chain whose fee is checked against the native balance. */
    total: Optional<UseSendTotalResult>
    /** Set while the native balance can't cover the send at the selected preset's worst-case fee. */
    feeShortfall: Optional<{ title: string; body: string }>
    /** True while the fee coverage check still waits on the fee or the native balance. */
    isFeeCoveragePending: boolean
}

export const useTransactionConfirmationScreen =
    (): useTransactionConfirmationScreenResult => {
        const scope = useSendScope()
        const networkName = useChainNameWhenMultiChain(scope.chainId)
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
        const { t, currentLanguage } = useLanguage()

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
        const { errorToast } = useToast()
        const { request: requestBottomSheet } = useBottomSheet()

        const selectedAddress = selectedAccount
            ? chainAccountOf(selectedAccount, scope.chainId)?.address
            : undefined
        const baseUnitAmount = useMemo(
            () =>
                amount && asset
                    ? displayUnitsToBaseUnits(amount, asset.decimals)
                    : undefined,
            [amount, asset],
        )
        const {
            feeAmount,
            maxFeeAmount,
            presets: feePresets,
            isPending: isFeePending,
            isError: isFeeError,
        } = useSendFeeQuery({
            scope,
            senderAddress: selectedAddress,
            assetId: selectedAssetId,
            recipient: destination,
            amount: baseUnitAmount,
            feePreset,
        })
        const sendConfirmation = chainUiFor(
            getChainDescriptor(scope.chainId).family,
        ).sendConfirmation

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
                destination && baseUnitAmount && selectedAssetId
                    ? {
                          recipient: destination,
                          asset: {
                              chainId: scope.chainId,
                              assetId: selectedAssetId,
                          },
                          amount: baseUnitAmount,
                          scope,
                      }
                    : undefined,
            [destination, baseUnitAmount, selectedAssetId, scope],
        )
        const { data: recipientWarning, isPending: isRecipientInfoPending } =
            useRecipientWarningQuery(recipientInput)
        const recipientSafety = useRecipientSafety({
            recipient: destination,
            senderAddress: selectedAddress,
            scope,
        })

        // A node refuses a send its native balance can't cover at the selected
        // preset's worst-case fee, so check that before signing. Algorand's
        // amount step already sizes the send against its reserve and close-out.
        const isFeeCoverageChecked = !sendFlowChainAdapters.has(scope.chainId)
        const nativeAsset = useNativeAsset(scope)
        const isNativeAssetId = useIsNativeAssetId(scope)
        const nativeSpendableInput = useMemo(
            () =>
                isFeeCoverageChecked && selectedAccount
                    ? {
                          account: selectedAccount,
                          asset: {
                              chainId: scope.chainId,
                              assetId: nativeAsset.assetId,
                          },
                          scope,
                          fee: ZERO_DECIMAL,
                      }
                    : undefined,
            [isFeeCoverageChecked, selectedAccount, nativeAsset.assetId, scope],
        )
        const { data: nativeSpendable } =
            useSpendableBalanceQuery(nativeSpendableInput)

        const feeShortfall = useMemo(() => {
            if (
                !isFeeCoverageChecked ||
                !maxFeeAmount ||
                !nativeSpendable ||
                !baseUnitAmount ||
                !selectedAssetId
            ) {
                return undefined
            }
            const nativeNeeded = isNativeAssetId(selectedAssetId)
                ? baseUnitAmount.plus(maxFeeAmount)
                : maxFeeAmount
            if (!nativeSpendable.max.lt(nativeNeeded)) {
                return undefined
            }
            const unitName = nativeAsset.unitName ?? ''
            const maxFee = toWholeUnits(maxFeeAmount, nativeAsset)
            const { precision, minPrecision } = resolvePrecision(
                'significant',
                nativeAsset.decimals,
                maxFee,
            )
            const maxFeeLabel = `${formatCurrency(
                maxFee,
                precision,
                unitName,
                currentLanguage,
                false,
                false,
                minPrecision,
            )} ${unitName}`
            return {
                title: t('send_funds.confirmation.fee_shortfall.title', {
                    symbol: unitName,
                }),
                body: t('send_funds.confirmation.fee_shortfall.body', {
                    fee: maxFeeLabel,
                }),
            }
        }, [
            isFeeCoverageChecked,
            maxFeeAmount,
            nativeSpendable,
            baseUnitAmount,
            selectedAssetId,
            isNativeAssetId,
            nativeAsset,
            t,
            currentLanguage,
        ])

        // A failed estimate stays slidable so Confirm can explain it in a toast.
        const isFeeCoveragePending =
            isFeeCoverageChecked &&
            !isFeeError &&
            (!maxFeeAmount || !nativeSpendable || !baseUnitAmount)

        const sendTotal = useSendTotal({
            scope,
            asset,
            amount,
            feeAmount,
        })

        const [isSigning, setIsSigning] = useState(false)
        const isFocused = useIsFocused()
        // Regaining focus after failed signing resets slide-to-confirm.
        useEffect(() => {
            if (isFocused) {
                setIsSigning(false)
            }
        }, [isFocused])

        const handleConfirm = () => {
            if (isRecipientInfoPending || recipientSafety.isConfirmBlocked) {
                return
            }

            if (
                !selectedAccount ||
                !selectedAssetId ||
                !destination ||
                !amount ||
                !asset
            ) {
                errorToast(
                    t('errors.transaction.title'),
                    t('errors.transaction.body'),
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                return
            }

            if (isFeeCoverageChecked) {
                if (isFeeError) {
                    errorToast(
                        t('send_funds.confirmation.fee_unavailable.title'),
                        t('send_funds.confirmation.fee_unavailable.body'),
                        {
                            notifier: bottomSheetNotifier.current ?? undefined,
                        },
                    )
                    return
                }
                // The screen shows the shortfall and disables Confirm.
                if (
                    !maxFeeAmount ||
                    !nativeSpendable ||
                    !baseUnitAmount ||
                    feeShortfall
                ) {
                    return
                }
            }

            if (recipientWarning) {
                errorToast(
                    t(
                        recipientWarning.title.key,
                        recipientWarning.title.params,
                    ),
                    recipientWarning.body
                        .map(paragraph => t(paragraph.key, paragraph.params))
                        .join(' '),
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
            scope,
            networkName,
            feeAmount,
            feePresets,
            isFeePending,
            feePreset,
            setFeePreset,
            isQuantumFee,
            currentBalance,
            currentBalancePending,
            note,
            FeeSection: sendConfirmation?.FeeSection ?? NeutralSendFeeSection,
            TrailingSection: sendConfirmation?.TrailingSection,
            openNote,
            handleConfirm,
            isCollectible: isCollectibleAsset,
            isReady,
            isCloseAccount,
            recipientWarning,
            isRecipientInfoPending,
            recipientSafety,
            isSigning,
            total: isFeeCoverageChecked ? sendTotal : undefined,
            feeShortfall,
            isFeeCoveragePending,
        }
    }
