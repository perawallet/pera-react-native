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
    useAccountAssetBalanceQuery,
    useSelectedAccount,
    chainAccountOf,
} from '@perawallet/wallet-core-accounts'
import {
    useIsNativeAssetId,
    useNativeAsset,
    isCollectible,
    toWholeUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import type { Maybe } from '@perawallet/wallet-core-shared'
import {
    useSendFeeQuery,
    useSpendableBalanceQuery,
    type ChainNotice,
} from '@perawallet/wallet-core-transactions'
import { useSendFunds, useSendScope } from '@modules/transactions/hooks'
import { useSendDestinationRouter } from '../useSendDestinationRouter'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { bottomSheetNotifier, PWText, PWView } from '@components/core'
import { useNavigation } from '@react-navigation/native'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useStyles } from './styles'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'

type CloseAccountChoice = 'close' | 'keepOpen'

export const useInputScreen = () => {
    const scope = useSendScope()
    const nativeAsset = useNativeAsset(scope)
    const isNativeAssetId = useIsNativeAssetId(scope)
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const selectedAccount = useSelectedAccount()
    const selectedAddress = selectedAccount
        ? chainAccountOf(selectedAccount, scope.chainId)?.address
        : undefined
    const {
        selectedAssetId,
        amount,
        pendingAmountBaseUnits,
        destination,
        shouldContinueToConfirm,
        feePreset,
        setAmount,
        setPendingAmountBaseUnits,
        setIsCloseAccount,
        setShouldContinueToConfirm,
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
            void resolveDestination(destination)
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

    const assetIDs = useMemo(
        () => (selectedAssetId ? [selectedAssetId] : []),
        [selectedAssetId],
    )
    const { data: assets } = useAssetsQuery(scope, assetIDs)

    const asset = useMemo(() => {
        if (!selectedAssetId) return null
        return assets.get(selectedAssetId)
    }, [selectedAssetId, assets])

    // TRANSFER deeplinks stash a base-unit amount on the store because
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

    // The same fee the confirmation screen prices from, so any amount derived
    // here reserves what the transaction can actually be charged.
    const { maxFeeAmount } = useSendFeeQuery({
        scope,
        senderAddress: selectedAddress,
        assetId: selectedAssetId,
        feePreset,
    })
    const { data: accountAssetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        selectedAssetId,
        scope,
    )

    // The fee is a network read that pauses offline, so the balance is priced
    // without it until it lands; Next stays gated on it below.
    const spendableInput = useMemo(
        () =>
            selectedAccount && selectedAssetId
                ? {
                      account: selectedAccount,
                      asset: {
                          chainId: scope.chainId,
                          assetId: selectedAssetId,
                      },
                      scope,
                      fee: maxFeeAmount ?? new Decimal(0),
                  }
                : undefined,
        [selectedAccount, selectedAssetId, scope, maxFeeAmount],
    )
    const { data: spendable, isPending: isSpendablePending } =
        useSpendableBalanceQuery(spendableInput)

    const totalBalance = useMemo(
        () =>
            asset && spendable
                ? toWholeUnits(spendable.balance, asset)
                : new Decimal(0),
        [asset, spendable],
    )

    const maxAmount = useMemo(
        () =>
            asset && spendable
                ? toWholeUnits(spendable.max, asset)
                : new Decimal(0),
        [asset, spendable],
    )

    const emptyAccount = spendable?.emptyAccount
    const reserveNotice = spendable?.reserveNotice
    const closeAmount = useMemo(
        () =>
            emptyAccount
                ? toWholeUnits(emptyAccount.amount, nativeAsset)
                : new Decimal(0),
        [emptyAccount, nativeAsset],
    )

    // When the chain can release the reserve (by closing, or by asking first),
    // MAX offers the whole balance and Next explains the reserve.
    const isReserveReleasable =
        !!emptyAccount || (!!reserveNotice && !reserveNotice.isFirm)

    // Until the fee is known the spendable balance holds nothing back for it,
    // so MAX would offer an amount the send can't pay for.
    const isMaxReady = maxFeeAmount !== undefined && !isSpendablePending

    const setMax = useCallback(() => {
        if (!isMaxReady) return
        setValueAndRef(
            (isReserveReleasable ? totalBalance : maxAmount).toString(),
        )
    }, [
        isMaxReady,
        isReserveReleasable,
        maxAmount,
        totalBalance,
        setValueAndRef,
    ])

    const translateParagraphs = useCallback(
        (notice: ChainNotice) =>
            notice.body.map(paragraph => t(paragraph.key, paragraph.params)),
        [t],
    )

    // Keeping the account open is the primary choice: some exchanges reject
    // incoming payments that carry a close-remainder-to.
    const requestCloseAccountChoice = useCallback(
        async (notice: ChainNotice) =>
            requestBottomSheet<CloseAccountChoice>({
                contents: (
                    <ConfirmActionContent<CloseAccountChoice>
                        icon='warning'
                        iconVariant='error'
                        title={t(notice.title.key, notice.title.params)}
                        message={translateParagraphs(notice).join('\n')}
                        confirmLabel={t('send_funds.close_account.keep_open')}
                        confirmValue='keepOpen'
                        cancelLabel={t('common.cancel.label')}
                        tertiaryLabel={t('send_funds.close_account.confirm')}
                        tertiaryValue='close'
                        tertiaryVariant='destructiveLight'
                        confirmTestID='close_account_keep_open_button'
                        tertiaryTestID='close_account_confirm_button'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            }),
        [requestBottomSheet, t, translateParagraphs],
    )

    const requestReserveConfirm = useCallback(
        async (notice: ChainNotice) =>
            requestBottomSheet<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='warning'
                        iconVariant='error'
                        title={t(notice.title.key, notice.title.params)}
                        message={
                            <PWView style={styles.confirmMessage}>
                                {translateParagraphs(notice).map(
                                    (paragraph, index) => (
                                        <PWText
                                            key={index}
                                            variant='body'
                                        >
                                            {paragraph}
                                        </PWText>
                                    ),
                                )}
                            </PWView>
                        }
                        confirmLabel={t('common.continue.label')}
                        cancelLabel={t('common.cancel.label')}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            }),
        [requestBottomSheet, t, translateParagraphs, styles.confirmMessage],
    )

    const confirmCloseAccount = useCallback(() => {
        setIsCloseAccount(true)
        setAmount(closeAmount)
        setValueAndRef(closeAmount.toString())
        proceedToDestination()
    }, [
        closeAmount,
        proceedToDestination,
        setAmount,
        setIsCloseAccount,
        setValueAndRef,
    ])

    // Resets the close flag too: coming back from a confirmed close and
    // picking the reserve path would otherwise still send a close-out.
    const continuePastMax = useCallback(() => {
        setIsCloseAccount(false)
        setAmount(maxAmount)
        setValueAndRef(maxAmount.toString())
        proceedToDestination()
    }, [
        maxAmount,
        proceedToDestination,
        setAmount,
        setIsCloseAccount,
        setValueAndRef,
    ])

    const showExceedsBalance = useCallback(() => {
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
    }, [showToast, t])

    const handleNext = useCallback(async () => {
        const amountValue = value ? new Decimal(value) : null
        // Zero-amount ALGO payments are valid on-chain (used for notes and
        // sync pings). Zero stays rejected for ASAs, where the destination
        // router could misroute a 0 send into the Express/ARC-59 opt-in
        // flows that cost the sender real ALGO.
        const isZeroAllowed = isNativeAssetId(selectedAssetId)
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
            showExceedsBalance()
            return
        }

        if (amountValue.gt(maxAmount)) {
            if (emptyAccount) {
                const choice = await requestCloseAccountChoice(
                    emptyAccount.notice,
                )
                if (choice === 'close') {
                    confirmCloseAccount()
                } else if (choice === 'keepOpen') {
                    continuePastMax()
                }
            } else if (reserveNotice) {
                const confirmed = await requestReserveConfirm(reserveNotice)
                if (confirmed) {
                    continuePastMax()
                }
            } else {
                showExceedsBalance()
            }
            return
        }

        setIsCloseAccount(false)
        setAmount(amountValue)
        proceedToDestination()
    }, [
        isNativeAssetId,
        value,
        selectedAssetId,
        maxAmount,
        totalBalance,
        proceedToDestination,
        showToast,
        t,
        emptyAccount,
        reserveNotice,
        setIsCloseAccount,
        setAmount,
        requestCloseAccountChoice,
        requestReserveConfirm,
        showExceedsBalance,
        confirmCloseAccount,
        continuePastMax,
    ])

    // Next checks the amount against these balances; pressing it before they
    // load would reject a valid amount as exceeding a zero balance.
    const isBalanceReady = !!spendable
    const canCheckAmount =
        !!asset &&
        isBalanceReady &&
        !isSpendablePending &&
        maxFeeAmount !== undefined

    // A resumed send (see `shouldContinueToConfirm`) runs the user's own Next,
    // so every check a real tap makes still applies on the way to confirm.
    useEffect(() => {
        if (!shouldContinueToConfirm || !canCheckAmount || !isDestinationReady)
            return
        setShouldContinueToConfirm(false)
        void handleNext()
    }, [
        shouldContinueToConfirm,
        canCheckAmount,
        isDestinationReady,
        setShouldContinueToConfirm,
        handleNext,
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

    // A pasted amount replaces the current one, but only when it reads one way:
    // digits with at most one '.' or ',' and no more decimals than the asset
    // has. Anything else (letters, "1,234.56", "1.2.3") is dropped, never guessed.
    const handlePaste = useCallback(
        (text: string) => {
            const match = /^(\d*)(?:[.,](\d*))?$/.exec(text.trim())
            if (!match || !/\d/.test(text)) return
            const [, whole, fraction] = match
            const decimals = assetDecimalsRef.current
            if (fraction !== undefined && decimals === 0) return
            if (
                fraction !== undefined &&
                decimals != null &&
                fraction.length > decimals
            ) {
                return
            }
            const integerPart = (whole || '0').replace(/^0+(?=\d)/, '')
            setValueAndRef(
                fraction === undefined
                    ? integerPart
                    : `${integerPart}.${fraction}`,
            )
        },
        [setValueAndRef],
    )

    return {
        asset,
        accountAssetBalance,
        isBalanceReady,
        cryptoValue: value,
        isMaxReady,
        setMax,
        handleNext,
        handleKey,
        handlePaste,
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
