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

import { ActivityIndicator } from 'react-native'
import { useTheme } from '@rneui/themed'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    PWButton,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { SignerRow } from '../../utils/buildSignerRows'
import {
    SignerStatusListItem,
    type SignerAction,
} from '../SignerStatusListItem'
import { usePendingSignaturesContent } from './usePendingSignaturesContent'
import { useStyles } from './styles'

export type PendingSignaturesContentProps = Record<string, never>

export const PendingSignaturesContent = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const {
        signRequest,
        titleKey,
        bannerVariant,
        failureBannerKey,
        signedCount,
        threshold,
        timeRemaining,
        failReason,
        signers,
        handleClose,
        hasLoadError,
        handleRetryLoad,
        canSign,
        handleSign,
        handleSignParticipant,
        canCancel,
        isCancelling,
        handleCancel,
        disableOtherSignersForDraft,
    } = usePendingSignaturesContent()

    const getSignerAction = (signer: SignerRow): Optional<SignerAction> => {
        if (!signer.canSignAsHardware && !signer.isSigning) return undefined
        return {
            label: t('multisig.pending_signatures.sign'),
            onPress: () => handleSignParticipant(signer.address),
            isLoading: signer.isSigning,
            isDisabled: disableOtherSignersForDraft && !signer.isSigning,
        }
    }

    return (
        <PWSheetLayout
            header={
                <PWView style={styles.header}>
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {t(titleKey)}
                    </PWText>

                    {bannerVariant === 'failure' && (
                        <PWView
                            style={styles.failureBanner}
                            testID='pending_signatures_failure_banner'
                        >
                            <PWIcon
                                name='cross'
                                size='sm'
                                variant='error'
                            />
                            <PWText
                                variant='caption'
                                style={styles.failureBannerText}
                            >
                                {failReason ?? t(failureBannerKey)}
                            </PWText>
                        </PWView>
                    )}

                    {bannerVariant === 'success' && (
                        <PWView
                            style={styles.successBanner}
                            testID='pending_signatures_success_banner'
                        >
                            <PWIcon
                                name='check'
                                size='sm'
                                variant='positive'
                            />
                            <PWText
                                variant='caption'
                                style={styles.successBannerText}
                            >
                                {t('multisig.pending_signatures.confirmed')}
                            </PWText>
                        </PWView>
                    )}

                    {bannerVariant === 'submitting' && (
                        <PWView
                            style={styles.submittingBanner}
                            testID='pending_signatures_submitting_banner'
                        >
                            <ActivityIndicator
                                size='small'
                                color={theme.colors.textGray}
                            />
                            <PWText
                                variant='caption'
                                style={styles.submittingBannerText}
                            >
                                {t('multisig.pending_signatures.submitting')}
                            </PWText>
                        </PWView>
                    )}

                    {bannerVariant === 'waiting' && !!signRequest && (
                        <PWView style={styles.badgesRow}>
                            <PWView
                                style={styles.badge}
                                testID='pending_signatures_signed_count_badge'
                            >
                                <PWIcon
                                    name='check'
                                    size='sm'
                                    variant='secondary'
                                />
                                <PWText
                                    variant='caption'
                                    style={styles.badgeText}
                                >
                                    {t('multisig.pending_signatures.x_of_y', {
                                        signed: signedCount,
                                        total: threshold,
                                    })}
                                </PWText>
                            </PWView>
                            {!!timeRemaining && (
                                <PWView
                                    style={styles.badge}
                                    testID='pending_signatures_time_remaining_badge'
                                >
                                    <PWText
                                        variant='caption'
                                        style={styles.badgeText}
                                    >
                                        {t(
                                            'multisig.pending_signatures.time_left',
                                            { time: timeRemaining },
                                        )}
                                    </PWText>
                                </PWView>
                            )}
                        </PWView>
                    )}
                </PWView>
            }
            footer={
                canSign || canCancel ? (
                    <PWView style={styles.actionsRow}>
                        {canSign && (
                            <PWButton
                                variant='primary'
                                title={t('multisig.pending_signatures.sign')}
                                onPress={handleSign}
                                style={styles.actionButton}
                                testID='pending_signatures_sign_button'
                            />
                        )}
                        {canCancel && (
                            <PWButton
                                variant='secondary'
                                title={t('multisig.cancel_transaction.button')}
                                onPress={() => void handleCancel()}
                                isDisabled={isCancelling}
                                isLoading={isCancelling}
                                style={styles.actionButton}
                                testID='pending_signatures_cancel_button'
                            />
                        )}
                        <PWButton
                            variant='primary'
                            title={t(
                                'multisig.pending_signatures.close_for_now',
                            )}
                            onPress={handleClose}
                            style={styles.actionButton}
                            testID='pending_signatures_close_for_now_button'
                        />
                    </PWView>
                ) : (
                    <PWButton
                        variant='secondary'
                        title={t('multisig.pending_signatures.close')}
                        onPress={handleClose}
                        testID='pending_signatures_close_button'
                    />
                )
            }
        >
            <PWView style={styles.body}>
                {!signRequest && !hasLoadError && (
                    <PWView
                        style={styles.loadingContainer}
                        testID='pending_signatures_loading_indicator'
                    >
                        <ActivityIndicator
                            size='large'
                            color={theme.colors.textGray}
                        />
                    </PWView>
                )}

                {hasLoadError && (
                    <PWView
                        style={styles.errorContainer}
                        testID='pending_signatures_error_state'
                    >
                        <PWIcon
                            name='warning'
                            size='lg'
                            variant='error'
                        />
                        <PWText
                            variant='body'
                            style={styles.errorText}
                        >
                            {t('multisig.pending_signatures.load_error')}
                        </PWText>
                        <PWButton
                            variant='secondary'
                            title={t('multisig.pending_signatures.retry')}
                            onPress={handleRetryLoad}
                            testID='pending_signatures_retry_button'
                        />
                    </PWView>
                )}

                {!!signRequest && (
                    <PWView style={styles.accountsHeader}>
                        <PWText variant='h4'>
                            {t('multisig.pending_signatures.accounts_heading')}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.accountsHelpText}
                        >
                            {t(
                                'multisig.pending_signatures.accounts_subtitle',
                                { count: threshold },
                            )}
                        </PWText>
                    </PWView>
                )}

                {!!signRequest && (
                    <PWView style={styles.signersList}>
                        {signers.map((signer, index) => (
                            <SignerStatusListItem
                                // A multisig can list the same address twice,
                                // so address alone isn't a unique key.
                                key={`${signer.address}-${index}`}
                                address={signer.address}
                                status={signer.status}
                                action={getSignerAction(signer)}
                            />
                        ))}
                    </PWView>
                )}
            </PWView>
        </PWSheetLayout>
    )
}
