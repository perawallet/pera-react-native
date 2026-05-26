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

import Animated from 'react-native-reanimated'
import { PWIcon, PWToolbar, PWTouchableOpacity, PWView } from '@components/core'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useVisibleBanners } from '@perawallet/wallet-core-banners'
import { useShouldPlayConfetti } from '@modules/onboarding/hooks'

import { useAccountScreenAnimation } from './useAccountScreenAnimation'
import { useStyles } from './styles'
import { useModalState } from '@hooks/useModalState'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import { QRScannerView } from '@components/QRScannerView'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { ConfettiAnimation } from '@modules/accounts/components/ConfettiAnimation'
import { PromptContainer } from '@modules/prompts'
import { AccountTabNavigator } from '@modules/accounts/components/AccountTabNavigator'
import { NotificationsIcon } from '@modules/messages/components/NotificationsIcon'
import { AccountHeaderMenu } from '@components/AccountHeaderMenu'
import { HomeBannersStrip } from '@modules/banners'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const AccountScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const account = useSelectedAccount()
    const scannerState = useModalState()
    const { t } = useLanguage()

    const { shouldPlayConfetti, setShouldPlayConfetti } =
        useShouldPlayConfetti()

    const { getPreference } = usePreferences()
    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const { banners: visibleBanners } = useVisibleBanners()
    const hasHomeBanner = visibleBanners.length > 0
    const { animatedCornerStyle } = useAccountScreenAnimation(hasHomeBanner)

    if (!account) {
        return (
            <EmptyView
                title={t('account_details.main_screen.no_account_title')}
                body={t('account_details.main_screen.no_account_body')}
            />
        )
    }

    return (
        <PWView
            style={styles.container}
            testID='account_screen'
        >
            <ConfettiAnimation
                play={shouldPlayConfetti}
                onFinish={() => setShouldPlayConfetti(false)}
            />
            {hasHomeBanner && <HomeBannersStrip />}
            <Animated.View
                style={[
                    styles.content,
                    hasHomeBanner && styles.contentClipped,
                    animatedCornerStyle,
                ]}
            >
                <PWToolbar
                    style={styles.iconBar}
                    left={
                        <AccountSelection
                            style={styles.accountSelectionToolbar}
                        />
                    }
                    right={
                        <PWView style={styles.iconBarSection}>
                            <AccountHeaderMenu testID='account_screen_dropdown' />
                            <PWTouchableOpacity
                                onPress={scannerState.open}
                                testID='account_screen_qr_scanner_button'
                            >
                                <PWIcon name='camera' />
                            </PWTouchableOpacity>
                            <NotificationsIcon testID='account_screen_notifications' />
                        </PWView>
                    }
                />
                <AccountTabNavigator
                    account={account}
                    chartVisible={chartVisible}
                />
            </Animated.View>
            <QRScannerView
                isVisible={scannerState.isOpen}
                onSuccess={scannerState.close}
                onClose={scannerState.close}
                animationType='slide'
            />
            <PromptContainer />
        </PWView>
    )
}
