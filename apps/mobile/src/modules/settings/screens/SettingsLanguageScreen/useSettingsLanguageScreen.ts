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

import { useCallback, useMemo } from 'react'
import { useSettings } from '@perawallet/wallet-core-settings'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { useLanguage } from '@hooks/useLanguage'
import { BASE_LOCALE, resolveLocale } from '../../../../i18n/locales'
import { getEffectiveSupportedLocales } from '../../../../i18n/effectiveLocales'

type UseSettingsLanguageScreenResult = {
    language: string
    supportedLocales: string[]
    selectLanguage: (locale: string) => void
}

export const useSettingsLanguageScreen =
    (): UseSettingsLanguageScreenResult => {
        const { language, setLanguage } = useSettings()
        const { changeLanguage } = useLanguage()
        const remoteConfig = useRemoteConfig()

        // Reachable only via a Settings row already gated on this same flag
        // (useIsLanguageSelectionEnabled), so isEnabled is always true in
        // practice here — recomputed anyway rather than assumed, since this
        // hook and getEffectiveSupportedLocales are the single source of
        // truth useAppBootstrap also relies on, and must never drift from it.
        const effectiveSupportedLocales = useMemo(() => {
            const isEnabled = remoteConfig.getBooleanValue(
                RemoteConfigKeys.enable_language_selection,
                false,
            )
            const activeLocalesRaw = remoteConfig.getStringValue(
                RemoteConfigKeys.active_locales,
                '',
            )
            return getEffectiveSupportedLocales(isEnabled, activeLocalesRaw)
        }, [remoteConfig])

        // `getEffectiveSupportedLocales` adds `en` last when it isn't in the
        // allowlist, so Set order alone would push English to the bottom of
        // the picker. English first, then alphabetical.
        const supportedLocales = useMemo(
            () =>
                Array.from(effectiveSupportedLocales).sort((a, b) => {
                    if (a === BASE_LOCALE) return -1
                    if (b === BASE_LOCALE) return 1
                    return a.localeCompare(b)
                }),
            [effectiveSupportedLocales],
        )

        // `resolveLocale` handles both branches uniformly: a specific tag
        // returns itself if still in the effective set (the override
        // branch), 'system' resolves through the device locale list — same
        // function useAppBootstrap and i18n/index.ts use, so there's one
        // place this logic lives.
        const selectLanguage = useCallback(
            (locale: string) => {
                setLanguage(locale)
                const deviceLocales =
                    getProvider().deviceInfo.getDeviceLocales()
                changeLanguage(
                    resolveLocale(
                        locale,
                        deviceLocales,
                        effectiveSupportedLocales,
                    ),
                )
            },
            [setLanguage, changeLanguage, effectiveSupportedLocales],
        )

        return {
            language,
            supportedLocales,
            selectLanguage,
        }
    }
