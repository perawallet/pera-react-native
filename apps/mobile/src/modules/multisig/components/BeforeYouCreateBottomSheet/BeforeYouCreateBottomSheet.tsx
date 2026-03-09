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
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { useStyles } from './styles'

type BeforeYouCreateBottomSheetProps = {
    isVisible: boolean
    onProceed: () => void
    onGoBack: () => void
}

export const BeforeYouCreateBottomSheet = ({
    isVisible,
    onProceed,
    onGoBack,
}: BeforeYouCreateBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const handleLearnMore = () => {
        pushWebView({ url: config.multisigSupportUrl })
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onGoBack}
            innerContainerStyle={styles.container}
            enablePanDownToClose
        >
            <PWIcon
                name='info'
                variant='primary'
                size='xl'
                style={styles.icon}
            />

            <PWText variant='h3'>
                {t('multisig.before_you_create.title')}
            </PWText>

            <PWView style={styles.warningItem}>
                <PWView style={styles.numberBadge}>
                    <PWText
                        variant='caption'
                        style={styles.numberText}
                    >
                        1
                    </PWText>
                </PWView>
                <PWText
                    variant='body'
                    style={styles.warningText}
                >
                    {t('multisig.before_you_create.warning_participants')}
                </PWText>
            </PWView>

            <PWView style={styles.warningItem}>
                <PWView style={styles.numberBadge}>
                    <PWText
                        variant='caption'
                        style={styles.numberText}
                    >
                        2
                    </PWText>
                </PWView>
                <PWText
                    variant='body'
                    style={styles.warningText}
                >
                    {t('multisig.before_you_create.warning_rekey')}
                </PWText>
            </PWView>

            <PWView style={styles.linkContainer}>
                <PWButton
                    variant='link'
                    icon='info'
                    title={t('multisig.before_you_create.learn_more')}
                    paddingStyle='none'
                    onPress={handleLearnMore}
                    testID='before_create_learn_more_button'
                />
            </PWView>

            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    title={t('multisig.before_you_create.proceed')}
                    onPress={onProceed}
                    paddingStyle='dense'
                    testID='before_create_proceed_button'
                />

                <PWButton
                    variant='secondary'
                    title={t('multisig.before_you_create.go_back')}
                    onPress={onGoBack}
                    paddingStyle='dense'
                    testID='before_create_go_back_button'
                />
            </PWView>
        </PWBottomSheet>
    )
}
