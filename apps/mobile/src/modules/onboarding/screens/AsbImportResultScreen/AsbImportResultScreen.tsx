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

import React from 'react'
import { PWResultView, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAsbImportResultScreen } from './useAsbImportResultScreen'

export const AsbImportResultScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        importedCount,
        skippedDuplicateCount,
        failedCount,
        variant,
        title,
        body,
        handleDone,
    } = useAsbImportResultScreen()

    const lines: { key: string; text: string; testID: string }[] = []
    if (importedCount > 0) {
        lines.push({
            key: 'imported',
            text: t('onboarding.asb_import.result.imported_count', {
                count: importedCount,
            }),
            testID: 'asb_import_result_imported',
        })
    }
    if (skippedDuplicateCount > 0) {
        lines.push({
            key: 'skipped',
            text: t('onboarding.asb_import.result.skipped_count', {
                count: skippedDuplicateCount,
            }),
            testID: 'asb_import_result_skipped',
        })
    }
    if (failedCount > 0) {
        lines.push({
            key: 'failed',
            text: t('onboarding.asb_import.result.failed_count', {
                count: failedCount,
            }),
            testID: 'asb_import_result_failed',
        })
    }

    return (
        <PWView style={styles.root}>
            <PWResultView
                variant={variant}
                title={title}
                body={body}
                primaryAction={{
                    label: t('onboarding.asb_import.result.done'),
                    onPress: handleDone,
                }}
                testID='asb_import_result'
            >
                {lines.length > 0 && (
                    <PWView style={styles.counts}>
                        {lines.map(line => (
                            <PWText
                                key={line.key}
                                variant='body'
                                testID={line.testID}
                                style={styles.countLine}
                            >
                                {line.text}
                            </PWText>
                        ))}
                    </PWView>
                )}
            </PWResultView>
        </PWView>
    )
}
