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
