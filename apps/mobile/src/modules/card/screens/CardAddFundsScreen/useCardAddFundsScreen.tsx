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

import { useCallback, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useAccountBalancesQuery,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    getKnownAssetId,
    useAssetsQuery,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import { type Maybe, type Nullable } from '@perawallet/wallet-core-shared'
import {
    CardFundingUnavailableError,
    useDepositToCardMutation,
} from '@perawallet/wallet-core-card'
import { useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNumberPadAmount } from '@components/NumberPad'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardSelectAssetContent } from '../../components/CardSelectAssetContent'
import { useCardComingSoonToast } from '../../hooks'
import { type PeraCardStackParamList } from '../../routes/types'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'
import { useCardAddFundsSwap } from './useCardAddFundsSwap'

type UseCardAddFundsScreenResult = {
    /** Funding account (active account placeholder until the contract links one). */
    fundingAccount: Nullable<WalletAccount>
    /** Currently selected source asset (USDC by default). */
    sourceAsset: Maybe<DisplayableAsset>
    /** Whether the source is USDC (deposit mode) vs another asset (swap mode). */
    isUsdc: boolean
    /** Source asset balance in the funding account, formatted. */
    balanceDisplay: string
    /** Raw typed amount string, or null/undefined when empty. */
    amount: Maybe<string>
    /** USDC the deposit/swap yields, e.g. "0.00 USDC". */
    secondaryDisplay: string
    /** Swap rate ("1 ALGO ≈ 0.30 USDC"), only in swap mode. */
    rate: Nullable<string>
    handleKey: (key?: string) => void
    onSelectAsset: () => Promise<void>
    isDepositDisabled: boolean
    isDepositing: boolean
    handleDeposit: () => void
}

export const useCardAddFundsScreen = (): UseCardAddFundsScreenResult => {
    const { network } = useNetwork()
    const navigation =
        useNavigation<NativeStackNavigationProp<PeraCardStackParamList>>()
    const { request: requestBottomSheet } = useBottomSheet()

    // TODO(card): use connectedFundingSourceAddress once the smart contract links
    // the card's funding source; until then fall back to the active account so
    // the balance + internal swap work against a real, funded account.
    const fundingAccount = useSelectedAccount()

    const usdcAssetId = useMemo(
        () => getKnownAssetId('USDC', network),
        [network],
    )
    const [pickedAssetId, setPickedAssetId] = useState<Nullable<string>>(null)
    const sourceAssetId = pickedAssetId ?? usdcAssetId
    // Both sides could independently be null; only call it USDC when there is
    // a known USDC id to compare against.
    const isUsdc = usdcAssetId !== null && sourceAssetId === usdcAssetId

    const assetIds = useMemo(
        () => [usdcAssetId, sourceAssetId].filter(id => id !== null),
        [usdcAssetId, sourceAssetId],
    )
    const { data: assets } = useAssetsQuery(assetIds)
    const usdcAsset = useMemo(
        () => (usdcAssetId === null ? undefined : assets.get(usdcAssetId)),
        [assets, usdcAssetId],
    )
    const sourceAsset = useMemo(
        () => (sourceAssetId === null ? undefined : assets.get(sourceAssetId)),
        [assets, sourceAssetId],
    )
    const sourceDecimals = sourceAsset?.decimals ?? 6
    const usdcDecimals = usdcAsset?.decimals ?? 6
    const usdcUnit = usdcAsset?.unitName ?? 'USDC'

    const { accountBalances } = useAccountBalancesQuery(
        fundingAccount ? [fundingAccount] : [],
    )
    const sourceBalance = useMemo(() => {
        if (!fundingAccount) return new Decimal(0)
        const balance = accountBalances
            ?.get(fundingAccount.address)
            ?.assetBalances?.find(
                asset => asset.assetId === sourceAssetId,
            )?.amount
        return balance ?? new Decimal(0)
    }, [accountBalances, fundingAccount, sourceAssetId])

    const {
        amount: value,
        amountDecimal,
        handleKey,
        setAmount,
    } = useNumberPadAmount({ decimals: sourceDecimals })

    const swap = useCardAddFundsSwap({
        account: fundingAccount,
        sourceAssetId: sourceAssetId ?? '',
        sourceDecimals,
        usdcAssetId: usdcAssetId ?? '',
        usdcDecimals,
        amount: amountDecimal,
        // No known USDC id on this network — nothing to swap into.
        enabled: !isUsdc && usdcAssetId !== null,
    })

    const onSelectAsset = useCallback(async (): Promise<void> => {
        const assetId = await requestBottomSheet<string>({
            contents: <CardSelectAssetContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!assetId) return
        setPickedAssetId(assetId)
        setAmount(null)
    }, [requestBottomSheet, setAmount])

    const balanceDisplay = useMemo(
        () => sourceBalance.toFixed(USDC_DISPLAY_PRECISION),
        [sourceBalance],
    )

    const usdcOutValue = isUsdc
        ? amountDecimal
        : (swap.usdcOut ?? new Decimal(0))
    const secondaryDisplay = `${usdcOutValue.toFixed(USDC_DISPLAY_PRECISION)} ${usdcUnit}`

    const isValidAmount =
        amountDecimal.gt(0) && amountDecimal.lte(sourceBalance)
    const isDepositDisabled =
        !fundingAccount ||
        !isValidAmount ||
        (!isUsdc && (!swap.quote || swap.isQuoteFetching))

    const deposit = useDepositToCardMutation()
    const showComingSoon = useCardComingSoonToast()

    const handleDeposit = useCallback(() => {
        // USDC → gated deposit-to-card (no Baanx backend yet → coming-soon).
        if (isUsdc) {
            // isUsdc being true already implies a non-null usdcAssetId; this
            // guard only narrows the type for the call below.
            if (usdcAssetId === null) return

            void deposit
                .mutateAsync({
                    sourceAsset: usdcAssetId,
                    sourceAmount: amountDecimal,
                })
                .catch(error => {
                    // TODO(card): surface real failures once the provider ships.
                    if (error instanceof CardFundingUnavailableError) {
                        showComingSoon()
                        return
                    }
                    showComingSoon()
                })
            return
        }

        // Non-USDC → confirm the swap on a dedicated screen before signing.
        // No known asset id to fund from (e.g. no USDC on this network and
        // nothing else picked) — nothing to confirm.
        if (sourceAssetId === null) return

        navigation.navigate('CardConfirmSwap', {
            sourceAssetId,
            amount: value ?? '0',
        })
    }, [
        isUsdc,
        deposit,
        usdcAssetId,
        amountDecimal,
        showComingSoon,
        navigation,
        sourceAssetId,
        value,
    ])

    return {
        fundingAccount,
        sourceAsset,
        isUsdc,
        balanceDisplay,
        amount: value,
        secondaryDisplay,
        rate: isUsdc ? null : swap.rate,
        handleKey,
        onSelectAsset,
        isDepositDisabled,
        isDepositing: isUsdc ? deposit.isPending : false,
        handleDeposit,
    }
}
