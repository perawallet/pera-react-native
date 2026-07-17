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

import { PWButton, PWSlideToConfirm, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { MultisigDeclineButton } from '@modules/multisig/components/MultisigDeclineButton'
import { useStyles } from './styles'
import { useSigningActionButtons } from './useSigningActionButtons'

export const SigningActionButtons = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        handleReject,
        handleSignAndSend,
        slideResetKey,
        isLoading,
        currentRequest,
        isMultisigCosign,
        cannotSignNotice,
        cosignSignerAddress,
    } = useSigningActionButtons()

    return (
        <PWView style={styles.container}>
            {cannotSignNotice ? (
                <PWView
                    style={styles.cannotSignNotice}
                    testID='signing-cannot-sign'
                >
                    <PWText variant='h4'>{cannotSignNotice.title}</PWText>
                    <PWText style={styles.cannotSignBody}>
                        {cannotSignNotice.body}
                    </PWText>
                </PWView>
            ) : (
                <PWSlideToConfirm
                    key={slideResetKey}
                    title={t('common.slide_to_confirm.label')}
                    onConfirm={handleSignAndSend}
                    isLoading={isLoading}
                    testID='signing-confirm-slide'
                />
            )}
            {isMultisigCosign && currentRequest && cosignSignerAddress ? (
                <MultisigDeclineButton
                    request={currentRequest}
                    signerAddress={cosignSignerAddress}
                    isDisabled={isLoading}
                />
            ) : (
                <PWButton
                    title={t('common.cancel.label')}
                    variant='linkNeutral'
                    onPress={handleReject}
                    isDisabled={isLoading}
                />
            )}
        </PWView>
    )
}
