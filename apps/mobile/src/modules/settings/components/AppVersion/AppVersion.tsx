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

import { useRef } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useToast } from '@hooks/useToast'
import { Pressable } from 'react-native'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { AppVersionText } from './AppVersionText'

const REQUIRED_TAPS = 10
const NOTIFY_FROM_TAP_COUNT = 7
const TAP_TIMEOUT = 1000

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
            setPreference(UserPreferences.debugToolsEnabled, true)
            showToast(
                {
                    title: '',
                    body: t('settings.developer.debug_tools_enabled'),
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
        return <AppVersionText />
    }

    return (
        <Pressable
            onPress={handlePress}
            testID='settings_app_version'
        >
            <AppVersionText />
        </Pressable>
    )
}
