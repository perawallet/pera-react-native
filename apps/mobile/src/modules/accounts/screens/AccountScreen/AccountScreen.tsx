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

import Animated from 'react-native-reanimated'
import { PWView } from '@components/core'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useVisibleBanners } from '@perawallet/wallet-core-banners'
import { useShouldPlayConfetti } from '@modules/onboarding'

import { useAccountScreenAnimation } from './useAccountScreenAnimation'
import { useStyles } from './styles'
import { useAccountDrawerPickerKind } from '@modules/accounts/components/AccountDrawer'
import { AccountHeaderToolbar } from '@modules/accounts/components/AccountHeaderToolbar'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { ConfettiAnimation } from '@modules/accounts/components/ConfettiAnimation'
import { AccountTabNavigator } from '@modules/accounts/components/AccountTabNavigator'
import { HomeBannersStrip } from '@modules/banners'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HomeEvent } from '@analytics'

const AnimatedPWView = Animated.createAnimatedComponent(PWView)

const HOME_HEADER_EVENTS = {
    qrScan: HomeEvent.QrScan,
    pasteLink: HomeEvent.PasteLink,
} as const

export const AccountScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const account = useSelectedAccount()
    const { t } = useLanguage()

    const { shouldPlayConfetti, setShouldPlayConfetti } =
        useShouldPlayConfetti()

    const { getPreference } = usePreferences()
    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const { banners: visibleBanners } = useVisibleBanners()
    const hasHomeBanner = visibleBanners.length > 0
    const { animatedCornerStyle } = useAccountScreenAnimation(hasHomeBanner)

    // Shapes the shared tab-shell drawer while this screen is focused.
    useAccountDrawerPickerKind('portfolio')

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
            <AnimatedPWView
                style={[
                    styles.content,
                    hasHomeBanner && styles.contentWithBanner,
                    hasHomeBanner && styles.contentClipped,
                    hasHomeBanner ? animatedCornerStyle : undefined,
                ]}
            >
                <AccountHeaderToolbar
                    testIDPrefix='account_screen'
                    events={HOME_HEADER_EVENTS}
                />
                <PWView style={styles.tabNavigator}>
                    <AccountTabNavigator
                        account={account}
                        chartVisible={chartVisible}
                    />
                </PWView>
            </AnimatedPWView>
        </PWView>
    )
}
