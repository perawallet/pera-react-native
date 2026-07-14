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

import { useRef, useMemo } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { config } from '@perawallet/wallet-core-config'
import { UserPreferences } from '@constants/user-preferences'
import { useToast } from '@hooks/useToast'
import { Pressable } from 'react-native'
import { PWText } from '@components/core'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable } from '@perawallet/wallet-core-shared'

const REQUIRED_TAPS = 10
const NOTIFY_FROM_TAP_COUNT = 7
const TAP_TIMEOUT = 1000

const Version = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const provider = usePeraProvider()
    const { getAppVersion, getAppBuild } = provider.deviceInfo

    const appVersion = useMemo(() => {
        // On CI tag builds, show the full release tag (e.g. v7.0.0-alpha.9) so QA
        // sees the exact prerelease; stable tags carry no suffix and local/off-tag
        // builds fall back to the native store version. Leading "v" stripped.
        return config.releaseTag
            ? config.releaseTag.replace(/^v/, '')
            : getAppVersion()
    }, [getAppVersion])

    const appBuild = useMemo(() => {
        return getAppBuild()
    }, [getAppBuild])

    return (
        <PWText
            variant='caption'
            style={styles.versionText}
        >
            {t('settings.main.version_footer', {
                version: appVersion,
                build: appBuild,
            })}
        </PWText>
    )
}

export type AppVersionProps = {
    enableSecretTaps?: boolean
}

export const AppVersion = ({ enableSecretTaps }: AppVersionProps) => {
    const { setPreference } = usePreferences()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const tapCount = useRef(0)
    const lastTapTime = useRef<Nullable<number>>(null)

    const handlePress = () => {
        const now = Date.now()

        if (lastTapTime.current && now - lastTapTime.current < TAP_TIMEOUT) {
            tapCount.current += 1
        } else {
            tapCount.current = 1
        }

        lastTapTime.current = now

        if (tapCount.current >= NOTIFY_FROM_TAP_COUNT) {
            showToast(
                {
                    title: '',
                    body: t('settings.developer.taps_to_notify', {
                        remaining: REQUIRED_TAPS - tapCount.current,
                    }),
                    type: 'info',
                },
                {
                    animationDuration: 1,
                    showAnimationDuration: 1,
                    hideAnimationDuration: 1,
                    queueMode: 'immediate',
                },
            )
        }

        if (tapCount.current >= REQUIRED_TAPS) {
            setPreference(UserPreferences.developerMenuEnabled, true)
            showToast(
                {
                    title: '',
                    body: t('settings.developer.developer_menu_enabled'),
                    type: 'success',
                },
                {
                    queueMode: 'reset',
                },
            )
            tapCount.current = 0
        }
    }

    if (!enableSecretTaps) {
        return <Version />
    }

    return (
        <Pressable
            onPress={handlePress}
            testID='settings_app_version'
        >
            <Version />
        </Pressable>
    )
}
