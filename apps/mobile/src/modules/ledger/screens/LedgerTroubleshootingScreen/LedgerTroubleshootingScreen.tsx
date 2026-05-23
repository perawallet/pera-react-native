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

import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useStyles } from './styles'
import { useLedgerTroubleshootingScreen } from './useLedgerTroubleshootingScreen'

export const LedgerTroubleshootingScreen = () => {
    const styles = useStyles()
    const { pairingStepKeys, commonIssueKeys, handleDone, t } =
        useLedgerTroubleshootingScreen()

    return (
        <PWScreen
            testID='ledger-troubleshooting-screen'
            contentContainerStyle={styles.content}
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        testID='ledger_troubleshooting_done_button'
                        title={t('ledger.troubleshooting.done')}
                        onPress={handleDone}
                        variant='primary'
                    />
                </PWView>
            }
        >
            <ScreenHeader
                title={t('ledger.troubleshooting.title')}
                description={t('ledger.troubleshooting.description')}
            />

            <PWText
                variant='h3'
                style={styles.sectionTitle}
            >
                {t('ledger.troubleshooting.pairing_steps_title')}
            </PWText>
            <PWView style={styles.list}>
                {pairingStepKeys.map((key, index) => (
                    <PWView
                        key={key}
                        style={styles.listItem}
                    >
                        <PWView style={styles.stepCircle}>
                            <PWText variant='bodySemibold'>
                                {String(index + 1)}
                            </PWText>
                        </PWView>
                        <PWText
                            variant='body'
                            style={styles.listItemText}
                        >
                            {t(key)}
                        </PWText>
                    </PWView>
                ))}
            </PWView>

            <PWText
                variant='h3'
                style={styles.sectionTitle}
            >
                {t('ledger.troubleshooting.common_issues_title')}
            </PWText>
            <PWView style={styles.list}>
                {commonIssueKeys.map(key => (
                    <PWView
                        key={key}
                        style={styles.listItem}
                    >
                        <PWView style={styles.bullet} />
                        <PWText
                            variant='body'
                            style={styles.listItemText}
                        >
                            {t(key)}
                        </PWText>
                    </PWView>
                ))}
            </PWView>
        </PWScreen>
    )
}
