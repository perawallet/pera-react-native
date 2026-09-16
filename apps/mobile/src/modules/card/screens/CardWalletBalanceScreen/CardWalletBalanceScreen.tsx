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

import { useLayoutEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
    PWButton,
    PWIcon,
    PWImage,
    PWScreen,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useCardWalletBalanceScreen } from './useCardWalletBalanceScreen'
import { useStyles } from './styles'

export const CardWalletBalanceScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation()
    const {
        kind,
        copy,
        hero,
        balanceDisplay,
        currencyDisplay,
        isLoading,
        isError,
        hasBalance,
        canWithdraw,
        handleWithdraw,
        refetch,
    } = useCardWalletBalanceScreen()

    useLayoutEffect(() => {
        navigation.setOptions({ title: copy.navigationTitle })
    }, [navigation, copy.navigationTitle])

    return (
        <PWScreen
            testID={`card-wallet-balance-${kind}`}
            footer={
                <PWButton
                    variant='primary'
                    title={t('peraCard.credits.claim_button')}
                    onPress={handleWithdraw}
                    isDisabled={!canWithdraw}
                    testID='card-wallet-balance-claim-cta'
                />
            }
        >
            <PWView style={styles.content}>
                <PWView style={styles.heroSection}>
                    <PWView
                        style={styles.artwork}
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility='no-hide-descendants'
                    >
                        <PWImage
                            source={hero}
                            style={styles.hero}
                            resizeMode='contain'
                            showLoadingIndicator={false}
                        />
                    </PWView>
                    <PWView style={styles.balanceSection}>
                        <PWText
                            variant='footnoteMedium'
                            style={styles.secondaryText}
                        >
                            {t(copy.balanceLabel)}
                        </PWText>
                        {isError ? (
                            <PWView style={styles.status}>
                                <PWText
                                    variant='body'
                                    style={styles.centeredText}
                                >
                                    {t('peraCard.credits.error_body')}
                                </PWText>
                                <PWButton
                                    variant='link'
                                    title={t('peraCard.credits.retry')}
                                    onPress={refetch}
                                    testID='card-wallet-balance-retry'
                                />
                            </PWView>
                        ) : isLoading || balanceDisplay === null ? (
                            <PWSkeleton style={styles.balanceSkeleton} />
                        ) : (
                            <>
                                <PWText
                                    variant='h1'
                                    style={styles.balance}
                                    testID='card-wallet-balance-amount'
                                >
                                    {balanceDisplay}{' '}
                                    <PWText
                                        variant='h3'
                                        style={styles.secondaryText}
                                    >
                                        {currencyDisplay}
                                    </PWText>
                                </PWText>
                                <PWView style={styles.status}>
                                    {!hasBalance && (
                                        <PWText
                                            variant='h3'
                                            style={styles.centeredText}
                                        >
                                            {t(copy.emptyTitle)}
                                        </PWText>
                                    )}
                                    <PWText
                                        variant='body'
                                        style={styles.centeredText}
                                    >
                                        {!hasBalance
                                            ? t(copy.emptyBody)
                                            : canWithdraw
                                              ? t(copy.body)
                                              : t(copy.notWithdrawableBody)}
                                    </PWText>
                                </PWView>
                            </>
                        )}
                    </PWView>
                </PWView>

                <PWView style={styles.guide}>
                    <PWText variant='h4'>{t(copy.howTitle)}</PWText>
                    <PWView style={styles.guideRow}>
                        <PWView style={styles.iconContainer}>
                            <PWIcon name='card' />
                        </PWView>
                        <PWView style={styles.guideText}>
                            <PWText variant='bodySemibold'>
                                {t(copy.howFirstTitle)}
                            </PWText>
                            <PWText
                                variant='bodyCompact'
                                style={styles.secondaryText}
                            >
                                {t(copy.howFirstBody)}
                            </PWText>
                        </PWView>
                    </PWView>
                    <PWView style={styles.guideRow}>
                        <PWView style={styles.iconContainer}>
                            <PWIcon name='wallet' />
                        </PWView>
                        <PWView style={styles.guideText}>
                            <PWText variant='bodySemibold'>
                                {t(copy.howSecondTitle)}
                            </PWText>
                            <PWText
                                variant='bodyCompact'
                                style={styles.secondaryText}
                            >
                                {t(copy.howSecondBody)}
                            </PWText>
                        </PWView>
                    </PWView>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
