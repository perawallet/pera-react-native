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
import { SafeAreaView } from 'react-native-safe-area-context'
import {
    IconName,
    PWButton,
    PWIcon,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { ParticipantCount } from '@components/ParticipantCount'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useImportSharedAccountScreen } from './useImportSharedAccountScreen'
import { useStyles } from './styles'

export const ImportSharedAccountScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
    const {
        address,
        isLoading,
        isError,
        threshold,
        participantAddresses,
        totalParticipants,
        isUserIncluded,
        isAlreadyImported,
        isAddDisabled,
        handleAddAccount,
        handleRetry,
        handleDismiss,
        handleIgnore,
    } = useImportSharedAccountScreen()

    const participantIconName: IconName = isDarkMode
        ? 'accounts/dark/multisig-account'
        : 'accounts/light/multisig-account'

    // Render the title + scanned address in the navigation toolbar with a
    // back arrow. The screen is deeplink-entered, so there is no back stack
    // for the default header button — the arrow leaves the import flow.
    useNavigationHeader({
        left: (
            <PWIcon
                style={styles.headerBackButton}
                name='chevron-left'
                onPress={handleDismiss}
            />
        ),
        title: (
            <PWView style={styles.toolbarTitle}>
                <PWText variant='h4'>{t('multisig.import.title')}</PWText>
                <PWText
                    style={styles.toolbarAddress}
                    testID='import-shared-account-address'
                >
                    {truncateAlgorandAddress(address)}
                </PWText>
            </PWView>
        ),
    })

    if (isLoading) {
        return (
            <PWView
                style={styles.container}
                testID='import-shared-account-screen'
            >
                <PWView style={styles.centerState}>
                    <ActivityIndicator />
                    <PWText style={styles.stateBody}>
                        {t('multisig.import.loading')}
                    </PWText>
                </PWView>
            </PWView>
        )
    }

    if (isError) {
        return (
            <PWView
                style={styles.container}
                testID='import-shared-account-screen'
            >
                <PWView style={styles.centerState}>
                    <PWText variant='h4'>
                        {t('multisig.import.error_title')}
                    </PWText>
                    <PWText style={styles.stateBody}>
                        {t('multisig.import.error_body')}
                    </PWText>
                    <PWButton
                        variant='secondary'
                        title={t('multisig.import.retry')}
                        onPress={handleRetry}
                        testID='import-shared-account-retry'
                    />
                </PWView>
            </PWView>
        )
    }

    return (
        <PWView
            style={styles.container}
            testID='import-shared-account-screen'
        >
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWView style={styles.infoCard}>
                    <PWView style={styles.infoRow}>
                        <PWView style={styles.infoRowLabels}>
                            <PWText variant='h4'>
                                {t('multisig.import.number_of_accounts')}
                            </PWText>
                            {isUserIncluded && (
                                <PWText style={styles.infoRowSubLabel}>
                                    {t('multisig.import.you_included')}
                                </PWText>
                            )}
                        </PWView>
                        <ParticipantCount
                            count={totalParticipants}
                            testID='import-shared-account-participant-count'
                        />
                    </PWView>
                    <PWView style={styles.infoRow}>
                        <PWView style={styles.infoRowLabels}>
                            <PWText variant='h4'>
                                {t('multisig.import.threshold')}
                            </PWText>
                            <PWText style={styles.infoRowSubLabel}>
                                {t('multisig.import.threshold_description')}
                            </PWText>
                        </PWView>
                        <PWText
                            variant='h2'
                            testID='import-shared-account-threshold'
                        >
                            {threshold}
                        </PWText>
                    </PWView>
                </PWView>

                <PWText
                    variant='h4'
                    style={styles.sectionHeading}
                >
                    {t('multisig.import.accounts_heading', {
                        count: totalParticipants,
                    })}
                </PWText>

                <PWView>
                    {participantAddresses.map((participant, index, arr) => (
                        <AddressDisplay
                            key={participant}
                            address={participant}
                            addressFormat='long'
                            iconName={participantIconName}
                            showSecondaryAddress
                            style={[
                                styles.participantRow,
                                index === arr.length - 1 &&
                                    styles.participantRowLast,
                            ]}
                            testID={`import-participant-row-${participant}`}
                        />
                    ))}
                </PWView>
            </PWScrollView>

            <SafeAreaView
                edges={['bottom']}
                style={styles.bottomBar}
            >
                {isAlreadyImported && (
                    <PWText style={styles.alreadyImportedNote}>
                        {t('multisig.import.already_imported')}
                    </PWText>
                )}
                <PWView style={styles.bottomActions}>
                    <PWButton
                        variant='secondary'
                        title={t('multisig.import.ignore')}
                        onPress={handleIgnore}
                        paddingStyle='dense'
                        style={styles.ignoreButton}
                        testID='import-shared-account-ignore-button'
                    />
                    <PWButton
                        variant='primary'
                        title={t('multisig.import.add_to_accounts')}
                        onPress={handleAddAccount}
                        isDisabled={isAddDisabled}
                        paddingStyle='dense'
                        style={styles.addButton}
                        testID='import-shared-account-add-button'
                    />
                </PWView>
            </SafeAreaView>
        </PWView>
    )
}
