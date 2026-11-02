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

import { Animated } from 'react-native'
import {
    PWButton,
    PWRoundIcon,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { ScanNetworkRow } from './ScanNetworkRow'
import { useStyles } from './styles'
import { useSearchAccountsScreen } from './useSearchAccountsScreen'

export const SearchAccountsScreen = () => {
    const {
        t,
        dotOpacities,
        progressLabel,
        networks,
        canCancel,
        isCancelling,
        handleCancel,
    } = useSearchAccountsScreen()
    const styles = useStyles()

    return (
        <PWScreen
            scroll='never'
            footer={
                canCancel ? (
                    <PWButton
                        testID='search_accounts_cancel_button'
                        title={t('onboarding.searching_accounts.cancel')}
                        variant='secondary'
                        onPress={handleCancel}
                        isLoading={isCancelling}
                    />
                ) : undefined
            }
        >
            <PWView style={styles.container}>
                <PWView style={styles.topRow}>
                    <PWRoundIcon
                        icon='globe'
                        iconSize='lg'
                    />

                    <PWView style={styles.dotsContainer}>
                        <Animated.View
                            style={[
                                styles.dot,
                                styles.dot1,
                                { opacity: dotOpacities[0] },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                styles.dot2,
                                { opacity: dotOpacities[1] },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                styles.dot3,
                                { opacity: dotOpacities[2] },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                styles.dot4,
                                { opacity: dotOpacities[3] },
                            ]}
                        />
                    </PWView>

                    <PWRoundIcon
                        icon='phone'
                        iconSize='lg'
                    />
                </PWView>

                <PWView style={styles.heading}>
                    <PWText
                        variant='h3'
                        style={styles.title}
                    >
                        {t('onboarding.searching_accounts.title')}
                    </PWText>
                    {!!progressLabel && (
                        <PWText
                            style={styles.progress}
                            testID='search_accounts_progress'
                        >
                            {progressLabel}
                        </PWText>
                    )}
                </PWView>

                {networks.length > 0 && (
                    <PWView style={styles.networks}>
                        {networks.map(network => (
                            <ScanNetworkRow
                                key={network.chainId}
                                network={network}
                            />
                        ))}
                    </PWView>
                )}
            </PWView>
        </PWScreen>
    )
}
