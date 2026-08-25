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

import { Decimal } from 'decimal.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    isRekeyedAccount,
    useAccountAssetBalanceQuery,
    useAccountBalancesQuery,
    useAccountInformationQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'
import { useSendDestinationRouter } from '../useSendDestinationRouter'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    ALGO_ASSET,
    isCollectible,
    toWholeUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'
import { bottomSheetNotifier, PWText, PWView } from '@components/core'
import { useNavigation } from '@react-navigation/native'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useStyles } from './styles'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { isAlgoAssetId, type Maybe } from '@perawallet/wallet-core-shared'

export const useInputScreen = () => {
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const selectedAccount = useSelectedAccount()
    const {
        selectedAssetId,
        amount,
        pendingAmountBaseUnits,
        destination,
        setAmount,
        setPendingAmountBaseUnits,
        setIsCloseAccount,
    } = useSendFunds()
    const {
        resolveDestination,
        isResolvingDestination,
        isReady: isDestinationReady,
        isAssetUnavailable,
    } = useSendDestinationRouter()

    // A value-bearing deeplink prefills the receiver, so once the amount is
    // confirmed we can route straight to the correct next screen instead of
    // pushing the (now redundant) destination picker. Falls back to the picker
    // if there's no prefill, or if the routing inputs aren't ready yet / the
    // asset is unavailable (SelectDestination then resolves or shows the error).
    const proceedToDestination = useCallback(() => {
        if (destination && isDestinationReady && !isAssetUnavailable) {
            resolveDestination(destination)
        } else {
            navigation.navigate('SelectDestination')
        }
    }, [
        destination,
        isDestinationReady,
        isAssetUnavailable,
        resolveDestination,
        navigation,
    ])
    const { request: requestBottomSheet } = useBottomSheet()
    const styles = useStyles()

    // Seed the input from the store's prefilled amount (set by deeplink
    // handlers / external callers that open SendFunds with values ready).
    // The initializer only runs on mount so subsequent typing / setMax /
    // close-account flows continue to drive `value` directly. Cast to
    // Maybe so setValue retains the same `string | null | undefined` shape
    // it had before — `setValueAndRef` and `handleKey` both pass undefined.
    const [value, setValue] = useState<Maybe<string>>(() =>
        amount ? amount.toString() : undefined,
    )
    const valueRef = useRef<Maybe<string>>(value)
    const setValueAndRef = useCallback((newValue: Maybe<string>) => {
        valueRef.current = newValue
        setValue(newValue)
    }, [])
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

    // ASSET_TRANSFER deeplinks stash a base-unit amount on the store because
    // they don't know the asset's `decimals` at parse time. Convert here once
    // the asset query resolves, mirror it into both `value` (the visual
    // input) and `amount` (the store's display-units amount), then clear the
    // pending field so we don't re-apply on later renders.
    useEffect(() => {
        if (!pendingAmountBaseUnits || !asset) return
        const display = toWholeUnits(BigInt(pendingAmountBaseUnits), asset)
        setValueAndRef(display.toString())
        setAmount(display)
        setPendingAmountBaseUnits(undefined)
    }, [
        pendingAmountBaseUnits,
        asset,
        setAmount,
        setPendingAmountBaseUnits,
        setValueAndRef,
    ])

    // PQ-aware: a quantum signer's fee is a multiple of the network minimum,
    // and this is the same resolver the confirmation screen displays from —
    // any amount derived here must reserve the fee the transaction will
    // actually carry, not the base one.
    const { minFee } = useMinFeeForSender(selectedAccount?.address)
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
        const assetAmount = assetToUse?.amount ?? new Decimal(0)
        return assetAmount
    }, [accountBalances, selectedAssetId, selectedAccount])

    const maxAmount = useMemo(() => {
        if (isAlgoAssetId(selectedAssetId)) {
            const balance = toWholeUnits(
                accountInformation?.amount ?? 0n,
                ALGO_ASSET,
            )
            const minBalance = toWholeUnits(
                accountInformation?.minBalance ?? 0n,
                ALGO_ASSET,
            )
            const fee = toWholeUnits(minFee ?? 0n, ALGO_ASSET)
            return Decimal.max(balance.sub(minBalance).sub(fee), new Decimal(0))
        } else {
            return Decimal.max(tokenBalance ?? new Decimal(0), new Decimal(0))
        }
    }, [selectedAssetId, minFee, accountInformation, tokenBalance])

    const totalBalance = useMemo(() => {
        if (isAlgoAssetId(selectedAssetId)) {
            const balance = toWholeUnits(
                accountInformation?.amount ?? 0n,
                ALGO_ASSET,
            )
            return Decimal.max(balance, new Decimal(0))
        } else {
            return Decimal.max(tokenBalance ?? new Decimal(0), new Decimal(0))
        }
    }, [selectedAssetId, accountInformation, tokenBalance])

    const minBalanceDisplay = useMemo(() => {
        if (isAlgoAssetId(selectedAssetId)) {
            return toWholeUnits(
                accountInformation?.minBalance ?? 0n,
                ALGO_ASSET,
            ).toString()
        }
        return '0'
    }, [selectedAssetId, accountInformation])

    // A rekeyed account can never close out or spend below its minimum
    // balance — the rekey would be lost and the account left unusable. So
    // MAX is the spendable amount, and the close-account path is suppressed.
    const isRekeyedSender = selectedAccount
        ? isRekeyedAccount(selectedAccount)
        : false

    const setMax = useCallback(() => {
        setValueAndRef((isRekeyedSender ? maxAmount : totalBalance).toString())
    }, [isRekeyedSender, maxAmount, totalBalance, setValueAndRef])

    const hasNoOptedInAssets = useMemo(() => {
        return (
            isAlgoAssetId(selectedAssetId) &&
            (accountInformation?.assets?.length ?? 0) === 0
        )
    }, [selectedAssetId, accountInformation?.assets])

    const requestCloseAccountConfirm = useCallback(async () => {
        return requestBottomSheet<boolean>({
            contents: (
                <ConfirmActionContent
                    icon='warning'
                    iconVariant='error'
                    title={t('send_funds.close_account.title')}
                    message={t('send_funds.close_account.body')}
                    confirmLabel={t('send_funds.close_account.confirm')}
                    cancelLabel={t('common.cancel.label')}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
    }, [requestBottomSheet, t])

    const requestInsufficientBalanceConfirm = useCallback(async () => {
        return requestBottomSheet<boolean>({
            contents: (
                <ConfirmActionContent
                    icon='warning'
                    iconVariant='error'
                    title={t('send_funds.input.min_balance_title')}
                    message={
                        <PWView style={styles.confirmMessage}>
                            <PWText variant='body'>
                                {t('send_funds.input.min_balance_amount', {
                                    minBalance: minBalanceDisplay,
                                })}
                            </PWText>
                            <PWText variant='body'>
                                {t('send_funds.input.min_balance_body')}
                            </PWText>
                        </PWView>
                    }
                    confirmLabel={t('common.continue.label')}
                    cancelLabel={t('common.cancel.label')}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
    }, [requestBottomSheet, t, minBalanceDisplay, styles.confirmMessage])

    const requestRekeyedMinBalanceConfirm = useCallback(async () => {
        return requestBottomSheet<boolean>({
            contents: (
                <ConfirmActionContent
                    icon='warning'
                    iconVariant='error'
                    title={t('send_funds.input.rekeyed_min_balance_title')}
                    message={
                        <PWView style={styles.confirmMessage}>
                            <PWText variant='body'>
                                {t(
                                    'send_funds.input.rekeyed_min_balance_amount',
                                    { minBalance: minBalanceDisplay },
                                )}
                            </PWText>
                            <PWText variant='body'>
                                {t('send_funds.input.rekeyed_min_balance_body')}
                            </PWText>
                        </PWView>
                    }
                    confirmLabel={t('common.continue.label')}
                    cancelLabel={t('common.cancel.label')}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
    }, [requestBottomSheet, t, minBalanceDisplay, styles.confirmMessage])

    const confirmCloseAccount = useCallback(() => {
        const fee = toWholeUnits(minFee ?? 0n, ALGO_ASSET)
        const closeAmount = Decimal.max(totalBalance.sub(fee), new Decimal(0))
        setIsCloseAccount(true)
        setAmount(closeAmount)
        setValueAndRef(closeAmount.toString())
        proceedToDestination()
    }, [
        totalBalance,
        minFee,
        proceedToDestination,
        setAmount,
        setIsCloseAccount,
        setValueAndRef,
    ])

    const continuePastMbr = useCallback(() => {
        setAmount(maxAmount)
        setValueAndRef(maxAmount.toString())
        proceedToDestination()
    }, [maxAmount, proceedToDestination, setAmount, setValueAndRef])

    const handleNext = useCallback(async () => {
        const amountValue = value ? new Decimal(value) : null
        // Zero-amount ALGO payments are valid on-chain (used for notes and
        // sync pings). Zero stays rejected for ASAs, where the destination
        // router could misroute a 0 send into the Express/ARC-59 opt-in
        // flows that cost the sender real ALGO.
        const isZeroAllowed = isAlgoAssetId(selectedAssetId)
        if (
            !amountValue ||
            amountValue.lt(0) ||
            (!isZeroAllowed && amountValue.isZero())
        ) {
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

        if (amountValue.gt(totalBalance)) {
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

        if (amountValue.gt(maxAmount)) {
            if (isRekeyedSender) {
                // No close-account path for a rekeyed account — clamp to the
                // spendable max instead.
                const confirmed = await requestRekeyedMinBalanceConfirm()
                if (confirmed) {
                    continuePastMbr()
                }
            } else if (hasNoOptedInAssets) {
                const confirmed = await requestCloseAccountConfirm()
                if (confirmed) {
                    confirmCloseAccount()
                }
            } else {
                const confirmed = await requestInsufficientBalanceConfirm()
                if (confirmed) {
                    continuePastMbr()
                }
            }
            return
        }

        setIsCloseAccount(false)
        setAmount(amountValue)
        proceedToDestination()
    }, [
        value,
        selectedAssetId,
        maxAmount,
        totalBalance,
        proceedToDestination,
        showToast,
        t,
        hasNoOptedInAssets,
        isRekeyedSender,
        setIsCloseAccount,
        setAmount,
        requestCloseAccountConfirm,
        requestInsufficientBalanceConfirm,
        requestRekeyedMinBalanceConfirm,
        confirmCloseAccount,
        continuePastMbr,
    ])

    const isCollectibleAsset = useMemo(
        () => (asset ? isCollectible(asset) : false),
        [asset],
    )

    const assetDecimalsRef = useRef(asset?.decimals)
    assetDecimalsRef.current = asset?.decimals

    const handleKey = useCallback(
        (key?: string) => {
            const current = valueRef.current ?? null
            if (key) {
                if (key === '.' && assetDecimalsRef.current === 0) {
                    return
                }
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
        accountInformation,
        minBalanceDisplay,
        cryptoValue: value,
        setMax,
        handleNext,
        handleKey,
        // True while a deeplink-prefilled external receiver's opt-in status is
        // being resolved on-chain after the user confirms the amount — the
        // screen shows a spinner until the router navigates onward.
        isResolvingDestination,
        isCollectible: isCollectibleAsset,
        //exposed for testing only
        setCryptoValue: setValueAndRef,
        totalBalance,
        maxAmount,
    }
}
