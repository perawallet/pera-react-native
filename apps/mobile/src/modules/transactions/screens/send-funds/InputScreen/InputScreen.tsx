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

import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { Decimal } from 'decimal.js'

import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useStyles } from './styles'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { NumberPad } from '@components/NumberPad'
import { useSendFunds } from '@modules/transactions/hooks'
import { AddNoteContent } from '../../../components/send-funds/AddNoteContent'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { SendFundsInfoContent } from '../../../components/send-funds/SendFundsInfoContent'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { LoadingView } from '@components/LoadingView'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useInputScreen } from './useInputScreen'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { SHORT_PROMPT_DISPLAY_DELAY } from '@constants/ui'

export const InputScreen = () => {
    const styles = useStyles()
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const {
        asset,
        accountAssetBalance,
        accountInformation,
        cryptoValue,
        setMax,
        handleKey,
        handleNext,
        isResolvingDestination,
        isCollectible,
    } = useInputScreen()
    const selectedAccount = useSelectedAccount()
    const { canSelectAsset, note, onFinished } = useSendFunds()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()

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

    const openInfo = useCallback(() => {
        void requestBottomSheet({
            contents: <SendFundsInfoContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const { getPreference } = usePreferences()
    const hasAgreed = getPreference(UserPreferences.transactionInfoAgreed)
    const hasAutoOpenedRef = useRef(false)
    useEffect(() => {
        if (hasAgreed || hasAutoOpenedRef.current) return
        hasAutoOpenedRef.current = true
        const timer = setTimeout(() => {
            openInfo()
        }, SHORT_PROMPT_DISPLAY_DELAY)
        return () => clearTimeout(timer)
    }, [hasAgreed, openInfo])

    const handleBack = useCallback(() => {
        if (canSelectAsset) {
            navigation.navigate('AssetSelection')
        } else {
            onFinished?.()
        }
    }, [canSelectAsset, navigation, onFinished])

    // Memoize the header nodes so their identities stay stable across renders.
    // useNavigationHeader lists them as effect deps and calls setOptions; passing
    // fresh JSX every render re-fires the effect → setOptions → re-render loop
    // ("Maximum update depth exceeded" on the async-loading ASA path).
    const headerLeft = useMemo(
        () => (
            <PWIcon
                name={canSelectAsset ? 'chevron-left' : 'cross'}
                onPress={handleBack}
            />
        ),
        [canSelectAsset, handleBack],
    )
    const headerRight = useMemo(
        () => (
            <PWIcon
                name='info'
                onPress={openInfo}
            />
        ),
        [openInfo],
    )
    const headerTitle = useMemo(
        () => (
            <PWView style={styles.headerTitleContainer}>
                <PWText>
                    {t('send_funds.input_view.title', {
                        asset: asset?.name,
                    })}
                </PWText>
                <AccountDisplay
                    account={selectedAccount ?? undefined}
                    style={styles.accountDisplay}
                    iconProps={{ size: 'sm' }}
                    showChevron={false}
                    compact
                />
            </PWView>
        ),
        [styles, t, asset?.name, selectedAccount],
    )

    useNavigationHeader({
        left: headerLeft,
        right: headerRight,
        title: headerTitle,
    })

    // `params` is deliberately NOT gated here: suggested params are a
    // network-only fetch that pauses offline, and they're only needed to
    // build the transaction (fetched fresh at build time in
    // useTransactionSendFlow) — not to render the amount form. Gating on
    // them kept the whole Send entry point on a spinner while offline
    // (PERA-4579). The DB-backed gates below resolve offline.
    if (!asset || !accountAssetBalance || !accountInformation) {
        return <LoadingView variant='circle' />
    }

    // A deeplink-prefilled external receiver's opt-in is being resolved
    // on-chain after the amount was confirmed — hold on a spinner until the
    // router navigates onward, rather than leaving the amount form tappable.
    if (isResolvingDestination) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWScreen
            scroll='never'
            horizontalPadding='none'
            footer={
                <PWButton
                    variant='primary'
                    title={t('send_funds.input.next')}
                    style={styles.nextButton}
                    onPress={() => void handleNext()}
                    isDisabled={!cryptoValue}
                    testID='send_input_next_button'
                />
            }
        >
            <PWView style={styles.contentContainer}>
                <PWView style={styles.mainContentContainer}>
                    <AssetAmount
                        asset={asset}
                        value={
                            cryptoValue
                                ? new Decimal(cryptoValue)
                                : new Decimal(0)
                        }
                        rawValue={cryptoValue ?? undefined}
                        ignorePrivacyMode
                        variant='h1'
                        style={[
                            cryptoValue
                                ? styles.amount
                                : styles.amountPlaceholder,
                            styles.h1,
                        ]}
                        showSymbol={false}
                    />
                    {!isCollectible && (
                        <PreferredAmount
                            sourceAmount={
                                cryptoValue ? new Decimal(cryptoValue) : null
                            }
                            ignorePrivacyMode
                            sourceAssetId={accountAssetBalance?.assetId ?? ''}
                            showSymbol
                            variant='h1'
                            style={styles.amountPlaceholder}
                        />
                    )}

                    <PWView style={styles.buttonContainer}>
                        <PWButton
                            title={
                                note
                                    ? t('send_funds.confirmation.edit')
                                    : t('send_funds.add_note.button')
                            }
                            variant='secondary'
                            style={styles.secondaryButton}
                            onPress={openNote}
                            testID='send_input_note_button'
                        />
                        <PWButton
                            title={t('send_funds.input.max')}
                            variant='secondary'
                            style={styles.secondaryButton}
                            onPress={setMax}
                            testID='send_input_max_button'
                        />
                    </PWView>

                    <PWView style={styles.numpadContainer}>
                        <NumberPad
                            onPress={handleKey}
                            allowDecimal={(asset.decimals ?? 0) > 0}
                        />
                    </PWView>
                </PWView>

                <AccountAssetItemView
                    accountBalance={accountAssetBalance}
                    style={styles.assetDisplay}
                />
            </PWView>
        </PWScreen>
    )
}
