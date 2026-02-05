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

import {
    PWDropdown,
    PWDropdownItem,
    PWIcon,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { usePreferences, useSettings } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useMemo } from 'react'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useShouldPlayConfetti } from '@modules/onboarding/hooks'

import { useStyles } from './styles'
import { useModalState } from '@hooks/useModalState'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import { QRScannerView } from '@components/QRScannerView'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { ConfettiAnimation } from '@modules/accounts/components/ConfettiAnimation'
import { PromptContainer } from '@modules/prompts'
import { AccountTabNavigator } from '@modules/accounts/components/AccountTabNavigator'
import { NotificationsIcon } from '@modules/notifications/components/NotificationsIcon'

//TODO hook up all the button panel buttons correctly
//TODO implement more menu
//TODO figure out and implement banners/spot banners
//TODO implement account info screen somewhere (see old app top right corner)
//TODO implement rekey information && multisig information

export const AccountScreen = () => {
    const styles = useStyles()
    const account = useSelectedAccount()
    const scannerState = useModalState()
    const { t } = useLanguage()

    const { shouldPlayConfetti, setShouldPlayConfetti } =
        useShouldPlayConfetti()

    const { getPreference, setPreference } = usePreferences()
    const { privacyMode, setPrivacyMode } = useSettings()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)

    const dropdownItems: PWDropdownItem[] = useMemo(
        () => [
            {
                label: chartVisible
                    ? t('portfolio.hide_chart')
                    : t('portfolio.show_chart'),
                icon: chartVisible ? 'text-document' : 'chart',
                onPress: () =>
                    setPreference(UserPreferences.chartVisible, !chartVisible),
            },
            {
                label: privacyMode
                    ? t('common.exit_stealth_mode')
                    : t('common.enter_stealth_mode'),
                icon: 'eye',
                onPress: () => setPrivacyMode(!privacyMode),
            },
        ],
        [chartVisible, privacyMode, t, setPreference, setPrivacyMode],
    )

    if (!account) {
        return (
            <EmptyView
                title={t('account_details.main_screen.no_account_title')}
                body={t('account_details.main_screen.no_account_body')}
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <ConfettiAnimation
                play={shouldPlayConfetti}
                onFinish={() => setShouldPlayConfetti(false)}
            />
            <PWToolbar
                style={styles.iconBar}
                left={<AccountSelection />}
                right={
                    <PWView style={styles.iconBarSection}>
                        <PWDropdown items={dropdownItems}>
                            <PWIcon name='ellipsis' />
                        </PWDropdown>
                        <PWTouchableOpacity onPress={scannerState.open}>
                            <PWIcon name='camera' />
                        </PWTouchableOpacity>
                        <NotificationsIcon />
                    </PWView>
                }
            />
            <AccountTabNavigator account={account} />
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
