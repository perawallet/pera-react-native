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
import { useLanguage } from '@hooks/useLanguage'
import { useIsLanguageSelectionEnabled } from '@hooks/useIsLanguageSelectionEnabled'
import { useIsCloudBackupEnabled } from '@hooks/useIsCloudBackupEnabled'
import { config } from '@perawallet/wallet-core-config'
import { useCloudBackupStore } from '@perawallet/wallet-core-backup'
import { routeCapabilities } from '@routes/capabilities'
import type { IconName } from '@components/core'
import type { SettingsStackParamsList } from '../../routes'

export type SettingsOptionItem = {
    icon: IconName
    title: string
    route?: keyof SettingsStackParamsList
    url?: string
    action?: 'scanRekeyed'
    value?: string
}

export type SettingsOptionSection = {
    title: string
    items: SettingsOptionItem[]
}

export const useSettingsOptions = () => {
    const { t } = useLanguage()
    const isLanguageSelectionEnabled = useIsLanguageSelectionEnabled()
    const isCloudBackupEnabled = useIsCloudBackupEnabled()
    const isCloudBackupConfigured = useCloudBackupStore(state =>
        state.isConfigured(),
    )

    const settingsOptions = useMemo<SettingsOptionSection[]>(() => {
        const sections: SettingsOptionSection[] = [
            {
                title: t('settings.main.account_section'),
                items: [
                    ...(isCloudBackupEnabled
                        ? [
                              {
                                  route: 'CloudBackupSettings',
                                  icon: 'cloud-check',
                                  title: t('settings.main.cloud_backup_title'),
                                  value: t(
                                      isCloudBackupConfigured
                                          ? 'settings.main.cloud_backup_on'
                                          : 'settings.main.cloud_backup_off',
                                  ),
                              } satisfies SettingsOptionItem,
                          ]
                        : []),
                    {
                        route: routeCapabilities.vaultSecuritySettings
                            ? 'VaultSecuritySettings'
                            : 'SecuritySettings',
                        icon: 'shield-check',
                        title: t('settings.main.security_title'),
                    },
                    ...(routeCapabilities.pushNotificationSettings
                        ? [
                              {
                                  route: 'NotificationsSettings',
                                  icon: 'bell',
                                  title: t('settings.main.notifications_title'),
                              } satisfies SettingsOptionItem,
                          ]
                        : []),
                    // The unified Connections screen (web only) supersedes
                    // the two separate WalletConnect/Connected Sites menu
                    // entries below — when it's on, both are suppressed
                    // regardless of their own capability flags. The
                    // underlying routes/screens are untouched for direct
                    // navigation elsewhere (e.g. a WC pairing flow).
                    ...(routeCapabilities.connectionsSettings
                        ? [
                              {
                                  route: 'ConnectionsSettings',
                                  icon: 'globe',
                                  title: t('settings.main.connections_title'),
                              } satisfies SettingsOptionItem,
                          ]
                        : routeCapabilities.walletConnectSettings
                          ? [
                                {
                                    route: 'WalletConnectSettings',
                                    icon: 'wallet-connect',
                                    title: t(
                                        'settings.main.wallet_connect_title',
                                    ),
                                } satisfies SettingsOptionItem,
                            ]
                          : []),
                    ...(routeCapabilities.passkeysAutofillSettings
                        ? [
                              {
                                  route: 'PasskeysSettings',
                                  icon: 'person-key',
                                  title: t('settings.main.passkeys_title'),
                              } satisfies SettingsOptionItem,
                          ]
                        : []),
                    ...(!routeCapabilities.connectionsSettings &&
                    routeCapabilities.dappConnections
                        ? [
                              {
                                  route: 'ConnectedSites',
                                  icon: 'globe',
                                  title: t(
                                      'settings.main.connected_sites_title',
                                  ),
                              } satisfies SettingsOptionItem,
                          ]
                        : []),
                    ...(routeCapabilities.rekeyFlows
                        ? [
                              {
                                  // Sweeps every signable key for on-chain
                                  // accounts rekeyed to it — the
                                  // account-options action scans one key;
                                  // this is the wallet-wide entry.
                                  action: 'scanRekeyed',
                                  icon: 'magnifying-glass',
                                  title: t('settings.main.scan_rekeyed_title'),
                              } satisfies SettingsOptionItem,
                          ]
                        : []),
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
                    ...(isLanguageSelectionEnabled
                        ? [
                              {
                                  route: 'LanguageSettings',
                                  icon: 'globe',
                                  title: t('settings.main.language_title'),
                              } satisfies SettingsOptionItem,
                          ]
                        : []),
                    {
                        route: 'AdvancedSettings',
                        icon: 'gear',
                        title: t('settings.main.advanced_title'),
                    },
                ],
            },
            {
                title: t('settings.main.support_section'),
                items: [
                    ...(routeCapabilities.storeRating
                        ? [
                              {
                                  icon: 'star',
                                  title: t('settings.main.rate_title'),
                              } satisfies SettingsOptionItem,
                          ]
                        : []),
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
                    ...(routeCapabilities.developerSettings
                        ? [
                              {
                                  route: 'DeveloperSettings',
                                  icon: 'code',
                                  title: t('settings.main.developer_title'),
                              } satisfies SettingsOptionItem,
                          ]
                        : []),
                ],
            },
        ]

        return sections.filter(section => section.items.length > 0)
    }, [
        t,
        isLanguageSelectionEnabled,
        isCloudBackupEnabled,
        isCloudBackupConfigured,
    ])

    return {
        settingsOptions,
    }
}
