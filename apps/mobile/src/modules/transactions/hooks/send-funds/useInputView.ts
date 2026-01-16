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

import Decimal from 'decimal.js'
import { useCallback, useMemo, useState } from 'react'
import {
    useAccountBalancesQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    ALGO_ASSET,
    useAssetFiatPricesQuery,
    ALGO_ASSET_ID,
    toWholeUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import {
    useSuggestedParametersQuery,
    useAccountInformationQuery,
} from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import { bottomSheetNotifier } from '@components/core'

/**
 * A complex logic hook for the SendFundsInputView component.
 * Manages the multi-step form state for entering transaction amount and notes,
 * including validation against account balances and network fees.
 *
 * @param onNext Callback to move to the next screen in the flow
 * @returns State and handlers for the amount input view
 *
 * @example
 * const { handleNext, cryptoValue } = useInputView(() => navigate('Confirm'))
 */
export const useInputView = (onNext: () => void) => {
    const selectedAccount = useSelectedAccount()
    const { selectedAsset, note, setNote, setAmount } = useSendFunds()
    const [value, setValue] = useState<string | null>()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )
    const { data: assets } = useAssetsQuery()

    const asset = useMemo(() => {
        if (!selectedAsset?.assetId) return null
        return assets.get(selectedAsset?.assetId)
    }, [selectedAsset, assets])
    const { data: fiatPrices } = useAssetFiatPricesQuery()
    const fiatPrice = useMemo(
        () =>
            selectedAsset?.assetId
                ? (fiatPrices.get(selectedAsset?.assetId)?.fiatPrice ?? null)
                : null,
        [selectedAsset, fiatPrices],
    )

    const { data: params } = useSuggestedParametersQuery()
    const { data: accountInformation } = useAccountInformationQuery(
        selectedAccount?.address ?? '',
    )

    const tokenBalance = useMemo(() => {
        if (!selectedAccount) {
            return null
        }
        const assetToUse = accountBalances
            ?.get(selectedAccount.address)
            ?.assetBalances?.find(b => b.assetId === selectedAsset?.assetId)
        const assetAmount = assetToUse?.amount ?? Decimal(0)
        return assetAmount
    }, [accountBalances, selectedAsset?.assetId, selectedAccount])

    const maxAmount = useMemo(() => {
        if (selectedAsset?.assetId === ALGO_ASSET_ID) {
            const minFee = toWholeUnits(params?.minFee ?? 0, ALGO_ASSET)
            const amount = Decimal(accountInformation?.amount ?? 0)
            const maxAmount = amount.sub(
                accountInformation?.minBalance ?? +minFee,
            )
            return Decimal.max(maxAmount, Decimal(0))
        } else {
            return Decimal.max(tokenBalance ?? Decimal(0), Decimal(0))
        }
    }, [selectedAsset?.assetId, params, accountInformation, tokenBalance])

    const fiatValue = useMemo(() => {
        if (!value || !fiatPrice) {
            return null
        }

        return Decimal(value).mul(fiatPrice)
    }, [value, fiatPrice])

    const setMax = useCallback(() => {
        logger.debug('Max amount', { maxAmount: maxAmount.toString() })
        setAmount(maxAmount)
        setValue(maxAmount.toString())
    }, [maxAmount])

    const handleNext = useCallback(() => {
        if (!value || Decimal(value).lte(0)) {
            showToast(
                {
                    title: t('send_funds.input.error_title'),
                    body: t('send_funds.input.error_body', { min: 0 }),
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
            return
        }

        if (Decimal(value).gt(maxAmount)) {
            //TODO: show popup with explanation
            showToast(
                {
                    title: t('send_funds.input.error_title'),
                    body: t('send_funds.input.error_body', { min: 0 }),
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
            return
        }

        setAmount(Decimal(value ?? '0'))
        setNote(note ?? undefined)
        onNext()
    }, [value, maxAmount, note, onNext, showToast, t])

    const handleKey = useCallback(
        (key?: string) => {
            if (key) {
                setValue((value ?? '') + key)
            } else {
                if (value?.length) {
                    const newValue = value.substring(0, value.length - 1)
                    if (newValue.length) {
                        setValue(newValue)
                    } else {
                        setValue(null)
                    }
                }
            }
        },
        [value, setValue],
    )

    return {
        asset,
        selectedAsset,
        params,
        accountInformation,
        tokenBalance,
        maxAmount,
        setMax,
        handleNext,
        handleKey,
        fiatValue,
        cryptoValue: value,
        setCryptoValue: setValue,
        note,
        setNote,
    }
}
