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
import { useIsFocused } from '@react-navigation/native'
import { useLanguage } from '@hooks/useLanguage'
import { useCapability } from '@hooks/useCapability'
import { PWLoadingIndicator, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { OfflineTolerantView } from '@components/OfflineTolerantView'
import {
    AccountSelection,
    AccountDrawerPager,
    useAccountDrawerPickerKind,
    useFundPicker,
} from '@modules/accounts'
import {
    OnrampCountryChip,
    OnrampForm,
    OnrampHeaderTabs,
    OnrampHistoryContent,
    type OnrampTab,
} from '@modules/onramp/components'
import { useHasPendingRampOrders } from '@modules/onramp/hooks/useHasPendingRampOrders'
import { useStyles } from './styles'
import { useOnrampScreen } from './useOnrampScreen'

// Pager page order mirrors the header tab order.
const TAB_PAGES: OnrampTab[] = ['fund', 'history']

export const OnrampScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        isReady,
        pairsState,
        isPairsIntegrityBlocked,
        sourceToken,
        destinationToken,
        selectedPair,
        region,
        scope,
        canFundSelectedAccount,
        activeTab,
        handleTabChange,
        handleRegionInfoPress,
        handleRetryPairs,
    } = useOnrampScreen()

    const hasPendingHistory = useHasPendingRampOrders()
    // The screen stays mounted in the navigator after navigating away, so tab
    // state alone would keep the history poll alive off-screen.
    const isFocused = useIsFocused()

    // One definition behind the drawer and the sheet fallback alike.
    const accountPicker = useFundPicker()
    useAccountDrawerPickerKind('fund')
    const isOnrampOffered = useCapability({ anyChain: 'onramp' })

    // The pager is controlled off the active tab, so the header and a swipe are
    // two ways of setting the same value rather than two sources of truth.
    const handleNavigateToHistory = useCallback(
        () => handleTabChange('history'),
        [handleTabChange],
    )

    const handleIndexChange = useCallback(
        (pageIndex: number) => handleTabChange(TAB_PAGES[pageIndex]),
        [handleTabChange],
    )

    if (!isOnrampOffered) {
        return (
            <PWView style={styles.screen}>
                <EmptyView
                    icon='info'
                    title={t('onramp.testnet.title')}
                    body={t('onramp.testnet.body')}
                />
            </PWView>
        )
    }

    return (
        <PWView
            style={styles.screen}
            testID='onramp-screen'
        >
            <PWView style={styles.header}>
                <PWView style={styles.headerRow}>
                    <AccountSelection {...accountPicker} />
                    <OnrampCountryChip
                        countryCode={region?.countryCode}
                        onInfoPress={handleRegionInfoPress}
                    />
                </PWView>

                {canFundSelectedAccount && (
                    <OnrampHeaderTabs
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        badges={{ history: hasPendingHistory }}
                    />
                )}
            </PWView>

            {canFundSelectedAccount ? (
                <AccountDrawerPager
                    index={TAB_PAGES.indexOf(activeTab)}
                    onIndexChange={handleIndexChange}
                >
                    <PWView
                        key='fund'
                        style={styles.page}
                    >
                        {isReady ? (
                            // The chain's receive preparation runs as hooks
                            // inside the form, so a new chain remounts it.
                            <OnrampForm
                                key={scope?.chainId}
                                sourceToken={sourceToken}
                                destinationToken={destinationToken}
                                selectedPair={selectedPair}
                                onNavigateToHistory={handleNavigateToHistory}
                            />
                        ) : (
                            <OfflineTolerantView
                                isOffline={pairsState === 'offline'}
                                isIntegrityBlocked={isPairsIntegrityBlocked}
                                isError={pairsState === 'error'}
                                onRetry={handleRetryPairs}
                            >
                                <PWView style={styles.loadingWrapper}>
                                    <PWLoadingIndicator size='lg' />
                                </PWView>
                            </OfflineTolerantView>
                        )}
                    </PWView>
                    <PWView
                        key='history'
                        style={styles.page}
                    >
                        <OnrampHistoryContent
                            isActive={activeTab === 'history' && isFocused}
                        />
                    </PWView>
                </AccountDrawerPager>
            ) : (
                <EmptyView
                    icon='info'
                    title={t('onramp.account_unsupported.title')}
                    body={t('onramp.account_unsupported.body')}
                />
            )}
        </PWView>
    )
}
