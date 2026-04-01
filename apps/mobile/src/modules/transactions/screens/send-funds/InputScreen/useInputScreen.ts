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

import { Decimal } from 'decimal.js'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
    useAccountAssetBalanceQuery,
    useAccountBalancesQuery,
    useAccountInformationQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    toWholeUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useSuggestedParametersQuery } from '@perawallet/wallet-core-blockchain'
import { bottomSheetNotifier } from '@components/core'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'

export const useInputScreen = () => {
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const selectedAccount = useSelectedAccount()
    const { selectedAssetId, setAmount, setIsCloseAccount } = useSendFunds()

    // we maintain state and a ref to improve performance while retaining reactivity
    const [value, setValue] = useState<string | null>()
    const valueRef = useRef<string | null | undefined>(value)
    const setValueAndRef = useCallback(
        (newValue: string | null | undefined) => {
            valueRef.current = newValue
            setValue(newValue)
        },
        [],
    )
    const { showToast } = useToast()
    const { t } = useLanguage()

    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )
    const assetIDs = useMemo(
        () => (selectedAssetId ? [selectedAssetId] : []),
        [selectedAssetId],
    )
    const { data: assets } = useAssetsQuery(assetIDs)

    const asset = useMemo(() => {
        if (!selectedAssetId) return null
        return assets.get(selectedAssetId)
    }, [selectedAssetId, assets])
    const { data: params } = useSuggestedParametersQuery()
    const { data: accountInformation } = useAccountInformationQuery(
        selectedAccount?.address ?? '',
    )
    const { data: accountAssetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        selectedAssetId,
    )

    const tokenBalance = useMemo(() => {
        if (!selectedAccount) {
            return null
        }
        const assetToUse = accountBalances
            ?.get(selectedAccount.address)
            ?.assetBalances?.find(b => b.assetId === selectedAssetId)
        const assetAmount = assetToUse?.amount ?? Decimal(0)
        return assetAmount
    }, [accountBalances, selectedAssetId, selectedAccount])

    const maxAmount = useMemo(() => {
        if (selectedAssetId === ALGO_ASSET_ID) {
            const balance = toWholeUnits(
                accountInformation?.amount ?? 0n,
                ALGO_ASSET,
            )
            const minBalance = toWholeUnits(
                accountInformation?.minBalance ?? 0n,
                ALGO_ASSET,
            )
            const fee = toWholeUnits(params?.minFee ?? 0, ALGO_ASSET)
            return Decimal.max(balance.sub(minBalance).sub(fee), Decimal(0))
        } else {
            return Decimal.max(tokenBalance ?? Decimal(0), Decimal(0))
        }
    }, [selectedAssetId, params, accountInformation, tokenBalance])

    const totalBalance = useMemo(() => {
        if (selectedAssetId === ALGO_ASSET_ID) {
            const balance = toWholeUnits(
                accountInformation?.amount ?? 0n,
                ALGO_ASSET,
            )
            return Decimal.max(balance, Decimal(0))
        } else {
            return Decimal.max(tokenBalance ?? Decimal(0), Decimal(0))
        }
    }, [selectedAssetId, params, accountInformation, tokenBalance])

    const minBalanceDisplay = useMemo(() => {
        if (selectedAssetId === ALGO_ASSET_ID) {
            return toWholeUnits(
                accountInformation?.minBalance ?? 0n,
                ALGO_ASSET,
            ).toString()
        }
        return '0'
    }, [selectedAssetId, accountInformation])

    const setMax = useCallback(() => {
        setValueAndRef(totalBalance.toString())
    }, [totalBalance, setValueAndRef])

    const [isMaxExceeded, setIsMaxExceeded] = useState(false)
    const [isCloseAccountEligible, setIsCloseAccountEligible] = useState(false)

    const hasNoOptedInAssets = useMemo(() => {
        return (
            selectedAssetId === ALGO_ASSET_ID &&
            (accountInformation?.assets?.length ?? 0) === 0
        )
    }, [selectedAssetId, accountInformation?.assets])

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

        if (Decimal(value).gt(totalBalance)) {
            showToast(
                {
                    title: t('send_funds.input.exceeds_max_title'),
                    body: t('send_funds.input.exceeds_max_body'),
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
            return
        }

        if (Decimal(value).gt(maxAmount)) {
            if (hasNoOptedInAssets) {
                setIsCloseAccountEligible(true)
            } else {
                setIsMaxExceeded(true)
            }
            return
        }

        setIsCloseAccount(false)
        setAmount(Decimal(value ?? '0'))
        navigation.navigate('SelectDestination')
    }, [
        value,
        maxAmount,
        totalBalance,
        navigation,
        showToast,
        t,
        hasNoOptedInAssets,
        setIsCloseAccount,
    ])

    const dismissMaxExceeded = useCallback(() => {
        setIsMaxExceeded(false)
    }, [])

    const dismissCloseAccount = useCallback(() => {
        setIsCloseAccountEligible(false)
    }, [])

    const handleConfirmCloseAccount = useCallback(() => {
        const fee = toWholeUnits(params?.minFee ?? 0, ALGO_ASSET)
        const closeAmount = Decimal.max(totalBalance.sub(fee), Decimal(0))
        setIsCloseAccountEligible(false)
        setIsCloseAccount(true)
        setAmount(closeAmount)
        setValueAndRef(closeAmount.toString())
        navigation.navigate('SelectDestination')
    }, [
        totalBalance,
        params,
        navigation,
        setAmount,
        setIsCloseAccount,
        setValueAndRef,
    ])

    const handleContinuePastMbr = useCallback(() => {
        setIsMaxExceeded(false)
        setAmount(maxAmount)
        setValueAndRef(maxAmount.toString())
        navigation.navigate('SelectDestination')
    }, [maxAmount, navigation, setAmount, setValueAndRef])

    const assetDecimalsRef = useRef(asset?.decimals)
    assetDecimalsRef.current = asset?.decimals

    const handleKey = useCallback(
        (key?: string) => {
            const current = valueRef.current ?? null
            if (key) {
                if (key === '.' && (current ?? '').includes('.')) {
                    return
                }
                if (key === '.' && !current) {
                    setValueAndRef('0.')
                    return
                }
                const newValue = (current ?? '') + key
                const decimalIndex = newValue.indexOf('.')
                if (
                    assetDecimalsRef.current != null &&
                    decimalIndex !== -1 &&
                    newValue.length - decimalIndex - 1 >
                        assetDecimalsRef.current
                ) {
                    return
                }
                setValueAndRef(newValue)
            } else {
                if (current?.length) {
                    const newValue = current.substring(0, current.length - 1)
                    if (newValue.length) {
                        setValueAndRef(newValue)
                    } else {
                        setValueAndRef(null)
                    }
                }
            }
        },
        [setValueAndRef],
    )

    return {
        asset,
        accountAssetBalance,
        params,
        accountInformation,
        minBalanceDisplay,
        cryptoValue: value,
        isMaxExceeded,
        isCloseAccountEligible,
        setMax,
        handleNext,
        handleKey,
        handleContinuePastMbr,
        dismissMaxExceeded,
        dismissCloseAccount,
        handleConfirmCloseAccount,

        //exposed for testing only
        setCryptoValue: setValueAndRef,
        totalBalance,
        maxAmount,
    }
}
