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

import { PWButton, PWScreen, PWView } from '@components/core'
import { Decimal } from 'decimal.js'

import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useStyles } from './styles'
import { AccountAssetItemView } from '@modules/assets'
import { NumberPad } from '@components/NumberPad'
import { useSendFunds, useSendScope } from '@modules/transactions/hooks'
import { LoadingView } from '@components/LoadingView'
import { useInputScreen } from './useInputScreen'
import { useInputScreenActions } from './useInputScreenActions'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

export const InputScreen = () => {
    const styles = useStyles()
    const {
        asset,
        accountAssetBalance,
        isBalanceReady,
        isMaxReady,
        cryptoValue,
        setMax,
        handleKey,
        handlePaste,
        handleNext,
        isResolvingDestination,
        isCollectible,
        canAddNote,
    } = useInputScreen()
    const scope = useSendScope()
    const { canSelectAsset, note, onFinished } = useSendFunds()
    const { t } = useLanguage()

    const {
        openNote,
        headerLeft,
        headerRight,
        headerTitle,
        amountRef,
    } = useInputScreenActions({
        asset,
        accountAssetBalance,
        isBalanceReady,
        cryptoValue,
        isResolvingDestination,
        handleKey,
        handlePaste,
        handleNext,
        canSelectAsset,
        onFinished,
    })

    useNavigationHeader({
        left: headerLeft,
        right: headerRight,
        title: headerTitle,
    })

    // The min fee is deliberately NOT gated here: it derives from suggested
    // params, a network-only fetch that pauses offline, and it's only needed
    // to build the transaction (fetched fresh at build time in
    // useTransactionSendFlow) — not to render the amount form. Gating on
    // it kept the whole Send entry point on a spinner while offline.
    // The DB-backed gates below resolve offline.
    if (!asset || !accountAssetBalance || !isBalanceReady) {
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
                    <PWView
                        ref={amountRef}
                        focusable
                        accessibilityLabel={t('send_funds.input.amount_label')}
                        testID='send_input_amount'
                    >
                        <AssetAmount
                            chainId={scope.chainId}
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
                            shouldFitWidth
                        />
                    </PWView>
                    {!isCollectible && (
                        <PreferredAmount
                            sourceAmount={
                                cryptoValue ? new Decimal(cryptoValue) : null
                            }
                            ignorePrivacyMode
                            sourceAssetId={accountAssetBalance?.assetId ?? ''}
                            scope={scope}
                            showSymbol
                            variant='h1'
                            style={styles.amountPlaceholder}
                        />
                    )}

                    <PWView style={styles.buttonContainer}>
                        {canAddNote && (
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
                        )}
                        <PWButton
                            title={t('send_funds.input.max')}
                            variant='secondary'
                            style={styles.secondaryButton}
                            onPress={setMax}
                            isDisabled={!isMaxReady}
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
                    scope={scope}
                    style={styles.assetDisplay}
                />
            </PWView>
        </PWScreen>
    )
}
