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

import { ActivityIndicator } from 'react-native'
import {
    PWButton,
    PWCheckbox,
    PWIcon,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { RescanCandidateRow } from '../../components/RescanCandidateRow'
import { useRescanRekeyedSelectScreen } from './useRescanRekeyedSelectScreen'
import { useStyles } from './styles'

export const RescanRekeyedSelectScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        isLoading,
        isError,
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
        return (
            <PWView style={styles.statusContainer}>
                <ActivityIndicator size='large' />
                <PWText
                    variant='body'
                    style={styles.statusText}
                >
                    {t('rekey.rescan.fetching')}
                </PWText>
            </PWView>
        )
    }

    if (isError) {
        return (
            <PWView style={styles.statusContainer}>
                <PWText variant='h3'>{t('rekey.rescan.error_title')}</PWText>
                <PWText
                    variant='body'
                    style={styles.statusText}
                >
                    {t('rekey.rescan.error_body')}
                </PWText>
                <PWButton
                    variant='primary'
                    title={t('ledger.fetch_accounts.retry')}
                    onPress={handleRetry}
                    style={styles.retryButton}
                />
            </PWView>
        )
    }

    const hasCandidates = candidateAddresses.length > 0
    const hasImported = importedAddresses.length > 0

    if (!hasCandidates && !hasImported) {
        return (
            <PWView
                style={styles.container}
                testID='rescan-rekeyed-empty'
            >
                <PWView style={styles.emptyContent}>
                    <PWIcon
                        name='wallet'
                        size='xl'
                        variant='primary'
                    />
                    <PWText
                        variant='h2'
                        style={styles.emptyTitle}
                    >
                        {t('rekey.rescan.empty_title')}
                    </PWText>
                    <PWText
                        variant='bodyLarge'
                        style={styles.emptyBody}
                    >
                        {t('rekey.rescan.empty_body')}
                    </PWText>
                </PWView>
                <PWView style={styles.footer}>
                    <PWButton
                        variant='secondary'
                        title={t('rekey.rescan.empty_cta')}
                        onPress={handleSkip}
                        style={styles.cta}
                    />
                </PWView>
            </PWView>
        )
    }

    return (
        <PWView
            style={styles.container}
            testID='rescan-rekeyed-select-screen'
        >
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWView style={styles.header}>
                    <PWText variant='h1'>{t('rekey.rescan.title')}</PWText>
                    <PWText
                        variant='bodyLarge'
                        style={styles.subtitle}
                    >
                        {t('rekey.rescan.subtitle')}
                    </PWText>
                </PWView>

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
                                {/* Display-only — outer PWTouchableOpacity owns
                                    the gesture so a tap doesn't fire the
                                    toggle twice. */}
                                <PWCheckbox
                                    checked={isAllSelected}
                                    containerStyle={styles.checkboxContainer}
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
                                style={[styles.row, styles.rowDisabled]}
                            >
                                <PWText
                                    variant='bodyLarge'
                                    style={styles.disabledText}
                                >
                                    {truncateAlgorandAddress(address, 9)}
                                </PWText>
                            </PWView>
                        ))}
                    </PWView>
                )}
            </PWScrollView>

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
        </PWView>
    )
}
