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

import {
    PWButton,
    PWScreen,
    PWSlideToConfirm,
    PWText,
    PWView,
} from '@components/core'
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
        error,
        handleApprove,
        handleReject,
        handleDetailsPress,
    } = useArc60SigningScreen()

    if (!request || !parsed) return null

    if (parsed.type === 'error') {
        return (
            <PWScreen
                scroll={false}
                footer={
                    <PWView style={styles.buttonContainer}>
                        <PWButton
                            title={t('common.close.label')}
                            variant='primary'
                            onPress={handleReject}
                        />
                    </PWView>
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
            scroll={false}
            footer={
                <PWView style={styles.buttonContainer}>
                    <PWSlideToConfirm
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
                <Arc60DataSigningSummaryView
                    request={request}
                    account={account}
                    parsed={parsed}
                    onDetailsPress={handleDetailsPress}
                />
            </PWView>
            {!!error && (
                <PWText style={styles.errorText}>{error.message}</PWText>
            )}
        </PWScreen>
    )
}
