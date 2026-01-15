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

import { useRef, useMemo } from 'react'
import { useLanguage } from '@hooks/language'
import { useStyles } from './styles'
import { useDeviceInfoService } from '@perawallet/wallet-core-platform-integration'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useToast } from '@hooks/toast'
import { Pressable } from 'react-native'
import { PWText } from '@components/core'

const REQUIRED_TAPS = 10
const NOTIFY_FROM_TAP_COUNT = 7
const TAP_TIMEOUT = 1000

const Version = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { getAppVersion } = useDeviceInfoService()

    const appVersion = useMemo(() => {
        return getAppVersion()
    }, [getAppVersion])

    return (
        <PWText style={styles.versionText}>
            {t('settings.main.version_footer', { version: appVersion })}
        </PWText>
    )
}

export const AppVersion = ({
    enableSecretTaps,
}: {
    enableSecretTaps?: boolean
}) => {
    const { setPreference } = usePreferences()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const tapCount = useRef(0)
    const lastTapTime = useRef<number | null>(null)

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
        <Pressable onPress={handlePress}>
            <Version />
        </Pressable>
    )
}
