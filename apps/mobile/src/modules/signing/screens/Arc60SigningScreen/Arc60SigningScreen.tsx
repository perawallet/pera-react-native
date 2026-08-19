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

import {
    PWButton,
    PWRoundIcon,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { ConfirmAction } from '@components/ConfirmAction'
import { Arc60DataSigningSummaryView } from '@modules/signing/components/Arc60DataSigningView'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useArc60SigningScreen } from './useArc60SigningScreen'

export const Arc60SigningScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        request,
        account,
        parsed,
        isPending,
        canConfirm,
        errorMessage,
        hasOriginMismatch,
        isQuantumBlocked,
        handleApprove,
        handleReject,
        handleDetailsPress,
    } = useArc60SigningScreen()

    if (!request || !parsed) return null

    if (isQuantumBlocked) {
        return (
            <PWScreen
                scroll='never'
                footer={
                    <PWButton
                        title={t('common.close.label')}
                        variant='primary'
                        onPress={handleReject}
                    />
                }
            >
                <PWView
                    style={styles.bodyContainer}
                    testID='arc60-quantum-blocked'
                >
                    <EmptyView
                        title={t('quantum.data_signing_unsupported.title')}
                        body={t('quantum.data_signing_unsupported.body')}
                        shouldTruncateBody={false}
                    />
                </PWView>
            </PWScreen>
        )
    }

    if (parsed.type === 'error') {
        return (
            <PWScreen
                scroll='never'
                footer={
                    <PWButton
                        title={t('common.close.label')}
                        variant='primary'
                        onPress={handleReject}
                    />
                }
            >
                <PWView style={styles.bodyContainer}>
                    <EmptyView
                        title={t('signing.arc60_view.siwa_invalid')}
                        body={parsed.message}
                    />
                </PWView>
            </PWScreen>
        )
    }

    return (
        <PWScreen
            scroll='never'
            footer={
                <PWView style={styles.buttonContainer}>
                    <ConfirmAction
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={handleApprove}
                        isLoading={isPending}
                        isDisabled={!canConfirm}
                        testID='arc60-confirm-slide'
                    />
                    <PWButton
                        title={t('common.cancel.label')}
                        variant='linkNeutral'
                        onPress={handleReject}
                        isDisabled={isPending}
                    />
                </PWView>
            }
        >
            <PWView style={styles.bodyContainer}>
                {hasOriginMismatch && (
                    <PWView
                        style={styles.originWarning}
                        testID='arc60-origin-mismatch-warning'
                    >
                        <PWRoundIcon
                            icon='warning'
                            size='md'
                            variant='error'
                        />
                        <PWText
                            variant='body'
                            style={styles.originWarningText}
                        >
                            {t('signing.arc60_view.origin_mismatch', {
                                domain: request.stdSigData.domain,
                            })}
                        </PWText>
                    </PWView>
                )}
                <Arc60DataSigningSummaryView
                    request={request}
                    account={account}
                    parsed={parsed}
                    onDetailsPress={handleDetailsPress}
                />
            </PWView>
            {!!errorMessage && (
                <PWText style={styles.errorText}>{errorMessage}</PWText>
            )}
        </PWScreen>
    )
}
