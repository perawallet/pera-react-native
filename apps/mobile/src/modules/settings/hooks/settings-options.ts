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

import { useMemo } from 'react'
import { useLanguage } from '@hooks/language'
import { config } from '@perawallet/wallet-core-config'

export const useSettingsOptions = () => {
    const { t } = useLanguage()

    const settingsOptions = useMemo(
        () => [
            {
                title: t('settings.main.account_section'),
                items: [
                    {
                        route: 'SecuritySettings',
                        icon: 'shield-check',
                        title: t('settings.main.security_title'),
                    },
                    {
                        route: 'NotificationsSettings',
                        icon: 'bell',
                        title: t('settings.main.notifications_title'),
                    },
                    {
                        route: 'WalletConnectSettings',
                        icon: 'wallet-connect',
                        title: t('settings.main.wallet_connect_title'),
                    },
                    {
                        route: 'PasskeysSettings',
                        icon: 'person-key',
                        title: t('settings.main.passkeys_title'),
                    },
                ],
            },
            {
                title: t('settings.main.app_preferences_section'),
                items: [
                    {
                        route: 'CurrencySettings',
                        icon: 'dollar',
                        title: t('settings.main.currency_title'),
                    },
                    {
                        route: 'ThemeSettings',
                        icon: 'moon',
                        title: t('settings.main.theme_title'),
                    },
                ],
            },
            {
                title: t('settings.main.support_section'),
                items: [
                    {
                        icon: 'feedback',
                        title: t('settings.main.get_help_title'),
                        url: config.supportBaseUrl,
                    },
                    {
                        icon: 'star',
                        title: t('settings.main.rate_title'),
                    },
                    {
                        icon: 'text-document',
                        title: t('settings.main.terms_title'),
                        url: config.termsOfServiceUrl,
                    },
                    {
                        icon: 'text-document',
                        title: t('settings.main.privacy_title'),
                        url: config.privacyPolicyUrl,
                    },
                    {
                        route: 'DeveloperSettings',
                        icon: 'code',
                        title: t('settings.main.developer_title'),
                    },
                ],
            },
        ],
        [t],
    )

    return {
        settingsOptions,
    }
}
