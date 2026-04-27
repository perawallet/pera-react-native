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

import { PWButton, PWScrollView, PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import { useLedgerTroubleshootingScreen } from './useLedgerTroubleshootingScreen'

export const LedgerTroubleshootingScreen = () => {
    const styles = useStyles()
    const { pairingStepKeys, commonIssueKeys, handleDone, t } =
        useLedgerTroubleshootingScreen()

    return (
        <PWView
            style={styles.container}
            testID='ledger-troubleshooting-screen'
        >
            <PWScrollView contentContainerStyle={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('ledger.troubleshooting.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('ledger.troubleshooting.description')}
                </PWText>

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
            </PWScrollView>

            <PWView style={styles.footer}>
                <PWButton
                    testID='ledger_troubleshooting_done_button'
                    title={t('ledger.troubleshooting.done')}
                    onPress={handleDone}
                    variant='primary'
                />
            </PWView>
        </PWView>
    )
}
