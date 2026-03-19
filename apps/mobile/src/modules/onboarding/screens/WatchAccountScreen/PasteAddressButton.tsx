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

import React from 'react'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { PWText, PWTouchableOpacity } from '@components/core'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PasteAddressButtonProps = {
    address: string | null
    onPress: (address: string) => void
}

export const PasteAddressButton = ({
    address,
    onPress,
}: PasteAddressButtonProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: withTiming(address ? 1 : 0, { duration: 250 }),
    }))

    if (!address) return null

    const truncated = truncateAlgorandAddress(address)
    const label = `${t('onboarding.watch_account.paste_button')} (${truncated})`

    return (
        <Animated.View style={animatedStyle}>
            <PWTouchableOpacity
                testID='paste_address_button'
                style={styles.pasteButton}
                onPress={() => onPress(address)}
            >
                <PWText style={styles.pasteButtonText}>{label}</PWText>
            </PWTouchableOpacity>
        </Animated.View>
    )
}
