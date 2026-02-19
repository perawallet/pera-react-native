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

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { bottomSheetNotifier } from '@components/core'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import {
    useAccountAssetBalanceQuery,
    useSelectedAccount,
    type AssetWithAccountBalance,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    toDecimalUnits,
    useAssetFiatPricesQuery,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    useAlgorandClient,
    useSuggestedParametersQuery,
} from '@perawallet/wallet-core-blockchain'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    DEFAULT_PRECISION,
    formatCurrency,
} from '@perawallet/wallet-core-shared'

type useTransactionConfirmationScreenResult = {
    asset: PeraAsset | null | undefined
    amount: Decimal | undefined
    destination: string | undefined
    selectedAccount: WalletAccount | null
    selectedAsset: AssetWithAccountBalance | undefined
    fiatPrice: Decimal | null
    preferredFiatCurrency: string
    params: { minFee: bigint } | undefined
    paramsPending: boolean
    currentBalance: AssetWithAccountBalance | null
    currentBalancePending: boolean
    note: string | undefined
    noteOpen: boolean
    openNote: () => void
    closeNote: () => void
    handleConfirm: () => Promise<void>
    isReady: boolean
}

export const useTransactionConfirmationScreen =
    (): useTransactionConfirmationScreenResult => {
        const { selectedAsset, amount, destination, note, onFinished } =
            useSendFunds()
        const { signTransactions } = useTransactionSigner()
        const algokit = useAlgorandClient(signTransactions)

        const { data: assets } = useAssetsQuery()
        const asset = useMemo(() => {
            if (!selectedAsset?.assetId) return null
            return assets.get(selectedAsset?.assetId)
        }, [selectedAsset, assets])

        const selectedAccount = useSelectedAccount()
        const { showToast } = useToast()
        const [noteOpen, setNoteOpen] = useState(false)
        const { preferredFiatCurrency } = useCurrency()
        const { data: fiatPrices } = useAssetFiatPricesQuery()
        const fiatPrice = useMemo<Decimal | null>(() => {
            const price = selectedAsset
                ? fiatPrices.get(selectedAsset?.assetId)?.fiatPrice
                : null
            if (price) {
                return amount?.mul(price) ?? null
            }
            return null
        }, [selectedAsset, fiatPrices, amount])

        const { data: params, isPending: paramsPending } =
            useSuggestedParametersQuery()

        const openNote = () => {
            setNoteOpen(true)
        }

        const closeNote = () => {
            setNoteOpen(false)
        }

        const { data: currentBalance, isPending: currentBalancePending } =
            useAccountAssetBalanceQuery(
                selectedAccount ?? undefined,
                selectedAsset?.assetId,
            )

        const onSuccess = () => {
            showToast(
                {
                    title: 'Transfer Successful',
                    body: `You successfully sent ${formatCurrency(
                        amount!,
                        asset?.decimals ?? DEFAULT_PRECISION,
                        asset?.unitName ?? '',
                        'en-US',
                        false,
                        undefined,
                        2,
                    )} ${asset?.unitName ?? ''}.`,
                    type: 'success',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
            onFinished?.()
        }

        const handleConfirm = async () => {
            if (
                !selectedAccount ||
                !selectedAsset ||
                !destination ||
                !amount ||
                !asset
            ) {
                showToast(
                    {
                        title: 'Invalid transaction',
                        body: 'Something appears to have gone wrong with this transaction.',
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                return
            }

            try {
                if (selectedAsset.assetId === ALGO_ASSET_ID) {
                    await algokit.send.payment({
                        sender: selectedAccount!.address,
                        receiver: destination!,
                        amount: BigInt(
                            toDecimalUnits(amount, ALGO_ASSET).toString(),
                        ).microAlgo(),
                        note,
                    })

                    onSuccess()
                } else {
                    await algokit.send.assetTransfer({
                        sender: selectedAccount!.address,
                        receiver: destination!,
                        amount: BigInt(
                            toDecimalUnits(amount.toNumber(), asset).toString(),
                        ),
                        assetId: BigInt(selectedAsset.assetId),
                        note,
                    })

                    onSuccess()
                }
            } catch (error) {
                showToast(
                    {
                        title: 'Error sending transaction',
                        body: `${error}`,
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            }
        }

        const isReady = !!(selectedAccount && selectedAsset && amount && asset)

        return {
            asset,
            amount,
            destination,
            selectedAccount,
            selectedAsset,
            fiatPrice,
            preferredFiatCurrency,
            params,
            paramsPending,
            currentBalance,
            currentBalancePending,
            note,
            noteOpen,
            openNote,
            closeNote,
            handleConfirm,
            isReady,
        }
    }
