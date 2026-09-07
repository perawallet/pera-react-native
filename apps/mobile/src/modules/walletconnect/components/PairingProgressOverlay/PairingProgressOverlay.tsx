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

import React from 'react'
import { ActivityIndicator } from 'react-native'
import { useTheme } from '@rneui/themed'
import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { usePairingProgressStore } from '../../stores/usePairingProgressStore'
import { useStyles } from './styles'

/**
 * Full-screen "connecting" scrim for deep-link-initiated WC pairings. The
 * OS deep link gives the user no other feedback for the whole outcome wait
 * (up to 15s) — without this, a slow pairing is indistinguishable from the
 * tap having done nothing (mirror of the QR path's handling overlay).
 */
export const PairingProgressOverlay = () => {
    const isPairing = usePairingProgressStore(state => state.pendingCount > 0)
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    if (!isPairing) return null

    return (
        <PWView
            style={styles.overlay}
            testID='wc_pairing_progress_overlay'
        >
            <ActivityIndicator
                size='large'
                color={theme.colors.textWhite}
            />
            <PWText
                variant='body'
                style={styles.label}
            >
                {t('walletconnect.pairing.connecting')}
            </PWText>
        </PWView>
    )
}
