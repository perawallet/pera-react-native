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

import { useCallback } from 'react'
import { config } from '@perawallet/wallet-core-config'
import { PWButton, PWSheetLayout, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { useStyles } from './styles'

export const InboxInfoContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.assetInboxSupportUrl })
    }, [pushWebView])

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={<SheetHeader title='' />}
        >
            <PWView
                style={styles.content}
                testID='inbox_info_content'
            >
                <PWText
                    variant='h2'
                    style={styles.title}
                >
                    {t('messages.inbox.info.title')}
                </PWText>

                <PWView style={styles.section}>
                    <PWText variant='h4'>
                        {t('messages.inbox.info.algorand_title')}
                    </PWText>
                    <PWText style={styles.paragraph}>
                        {t('messages.inbox.info.algorand_body')}
                    </PWText>
                </PWView>

                <PWView style={styles.section}>
                    <PWText variant='h4'>
                        {t('messages.inbox.info.evm_title')}
                    </PWText>
                    <PWText style={styles.paragraph}>
                        {t('messages.inbox.info.evm_body')}
                    </PWText>
                    <PWText style={styles.paragraph}>
                        {t('messages.inbox.info.find_tokens_body')}
                    </PWText>
                </PWView>

                <PWButton
                    title={t('messages.inbox.info.learn_more')}
                    variant='secondary'
                    onPress={handleLearnMore}
                    testID='inbox_info_learn_more'
                />
            </PWView>
        </PWSheetLayout>
    )
}
