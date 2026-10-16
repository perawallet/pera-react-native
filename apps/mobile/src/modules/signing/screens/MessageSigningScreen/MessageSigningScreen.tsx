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

import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { ConfirmAction, CONFIRM_ACTION_LAYOUT } from '@components/ConfirmAction'
import { useLanguage } from '@hooks/useLanguage'
import { SignedDataWarning } from '@modules/signing/components/SignedDataWarning'
import { SourceMetadataView } from '@modules/signing/components/SourceMetadataView'
import { MessageTreeView } from './MessageTreeView'
import { useStyles } from './styles'
import { useMessageSigningScreen } from './useMessageSigningScreen'

export const MessageSigningScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        summary,
        signerAccount,
        sourceMetadata,
        verifiedOrigin,
        isPending,
        handleApprove,
        handleReject,
    } = useMessageSigningScreen()

    if (!summary) return null

    return (
        <PWScreen
            footer={
                <PWView style={[styles.buttonContainer, CONFIRM_ACTION_LAYOUT]}>
                    <ConfirmAction
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={handleApprove}
                        isLoading={isPending}
                        testID='message-signing-confirm-slide'
                    />
                    <PWButton
                        title={t('common.cancel.label')}
                        variant='linkNeutral'
                        onPress={handleReject}
                        isDisabled={isPending}
                        testID='message-signing-reject-button'
                    />
                </PWView>
            }
        >
            {!!sourceMetadata && (
                <SourceMetadataView
                    metadata={sourceMetadata}
                    verifiedOrigin={verifiedOrigin}
                />
            )}
            <PWView style={styles.bodyContainer}>
                <PWText variant='h2'>
                    {t(summary.title.key, summary.title.params)}
                </PWText>

                <PWView style={styles.section}>
                    <PWText
                        variant='captionMedium'
                        style={styles.sectionLabel}
                    >
                        {t('signing.arbitrary_data_view.data_label')}
                    </PWText>
                    {!!summary.preview && (
                        <PWView style={styles.dataBox}>
                            <PWText variant='mono'>{summary.preview}</PWText>
                        </PWView>
                    )}
                    {summary.kind === 'raw' && <SignedDataWarning />}
                    {!!summary.tree && <MessageTreeView nodes={summary.tree} />}
                </PWView>

                {!!signerAccount && (
                    <PWView style={styles.accountContainer}>
                        <PWText style={styles.onBehalfOf}>
                            {t('signing.arbitrary_data_view.on_behalf_of')}
                        </PWText>
                        <AccountDisplay
                            account={signerAccount}
                            showChevron={false}
                        />
                    </PWView>
                )}
            </PWView>
        </PWScreen>
    )
}
