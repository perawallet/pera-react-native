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

import { useMemo } from 'react'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import {
    PWButton,
    PWCheckbox,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { RescanCandidateRow } from '../../../components/rescan-rekeyed/RescanCandidateRow'
import { useRescanRekeyedSelectScreen } from './useRescanRekeyedSelectScreen'
import { useStyles } from './styles'

export const RescanRekeyedSelectScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const importedRowStyle = useMemo(
        () => [styles.row, styles.rowDisabled],
        [styles],
    )
    const {
        isLoading,
        isError,
        scanProgress,
        failedSourceCount,
        importedAddresses,
        candidateAddresses,
        selectedAddresses,
        isAllSelected,
        isSubmitting,
        canSubmit,
        toggleAddress,
        toggleSelectAll,
        handleAddSelected,
        handleSkip,
        handleRetry,
    } = useRescanRekeyedSelectScreen()

    if (isLoading) {
        const isSweepInProgress = (scanProgress?.total ?? 0) > 1
        return (
            <PWView style={styles.statusContainer}>
                <LoadingView
                    variant='circle'
                    size='lg'
                />
                <PWText
                    variant='body'
                    style={styles.statusText}
                >
                    {isSweepInProgress
                        ? t('rekey.rescan.sweep_fetching', {
                              scanned: scanProgress!.scanned,
                              total: scanProgress!.total,
                          })
                        : t('rekey.rescan.fetching')}
                </PWText>
            </PWView>
        )
    }

    if (isError) {
        return (
            <EmptyView
                testID='rescan-rekeyed-error'
                title={t('rekey.rescan.error_title')}
                body={t('rekey.rescan.error_body')}
                button={
                    <PWButton
                        variant='primary'
                        title={t('ledger.fetch_accounts.retry')}
                        onPress={handleRetry}
                    />
                }
            />
        )
    }

    const hasCandidates = candidateAddresses.length > 0
    const hasImported = importedAddresses.length > 0

    if (!hasCandidates && !hasImported) {
        return (
            <EmptyView
                testID='rescan-rekeyed-empty'
                icon='wallet'
                title={t('rekey.rescan.empty_title')}
                body={t('rekey.rescan.empty_body')}
                style={styles.emptyView}
                button={
                    <PWButton
                        variant='secondary'
                        title={t('rekey.rescan.empty_cta')}
                        onPress={handleSkip}
                    />
                }
            />
        )
    }

    return (
        <PWScreen
            testID='rescan-rekeyed-select-screen'
            footer={
                <PWView style={styles.footer}>
                    {hasCandidates && (
                        <PWButton
                            variant='primary'
                            title={t('rekey.rescan.cta_add')}
                            onPress={handleAddSelected}
                            isLoading={isSubmitting}
                            isDisabled={!canSubmit}
                            style={styles.cta}
                            testID='rescan-rekeyed-add'
                        />
                    )}
                    <PWButton
                        variant='secondary'
                        title={t('rekey.rescan.cta_skip')}
                        onPress={handleSkip}
                        style={styles.cta}
                        testID='rescan-rekeyed-skip'
                    />
                </PWView>
            }
        >
            <PWView style={styles.scrollContent}>
                <ScreenHeader
                    title={t('rekey.rescan.title')}
                    description={t('rekey.rescan.subtitle')}
                />

                {failedSourceCount > 0 && (
                    <PWText
                        variant='footnoteMedium'
                        style={styles.statusText}
                        testID='rescan-rekeyed-partial-notice'
                    >
                        {t('rekey.rescan.partial_failure_notice', {
                            count: failedSourceCount,
                        })}
                    </PWText>
                )}

                {hasCandidates && (
                    <PWView style={styles.section}>
                        <PWView style={styles.sectionHeaderRow}>
                            <PWText
                                variant='bodySemibold'
                                style={styles.sectionLabel}
                            >
                                {t('rekey.rescan.candidates_section')}
                            </PWText>
                            <PWTouchableOpacity
                                onPress={toggleSelectAll}
                                style={styles.selectAllRow}
                            >
                                <PWText
                                    variant='link'
                                    style={styles.selectAllText}
                                >
                                    {t('rekey.rescan.select_all')}
                                </PWText>
                                <PWCheckbox
                                    checked={isAllSelected}
                                    containerStyle={styles.checkboxContainer}
                                    testID='rescan-rekeyed-select-all-checkbox'
                                />
                            </PWTouchableOpacity>
                        </PWView>

                        {candidateAddresses.map(address => (
                            <RescanCandidateRow
                                key={address}
                                address={address}
                                isSelected={selectedAddresses.has(address)}
                                onToggle={toggleAddress}
                            />
                        ))}
                    </PWView>
                )}

                {hasImported && (
                    <PWView style={styles.section}>
                        <PWText
                            variant='bodySemibold'
                            style={styles.sectionLabel}
                        >
                            {t('rekey.rescan.imported_section')}
                        </PWText>

                        {importedAddresses.map(address => (
                            <PWView
                                key={address}
                                style={importedRowStyle}
                            >
                                <PWText
                                    variant='bodyLarge'
                                    style={styles.disabledText}
                                >
                                    {truncateAlgorandAddress(address)}
                                </PWText>
                            </PWView>
                        ))}
                    </PWView>
                )}
            </PWView>
        </PWScreen>
    )
}
