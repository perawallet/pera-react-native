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
import { ActivityIndicator } from 'react-native'
import { useTheme } from '@rneui/themed'
import { PWOverlay, PWText } from '@components/core'
import { useStyles } from './styles'

export type PWLoadingOverlayProps = {
    isVisible: boolean
    title?: string
}

export const PWLoadingOverlay = ({
    isVisible,
    title,
}: PWLoadingOverlayProps) => {
    const { theme } = useTheme()
    const styles = useStyles()

    return (
        <PWOverlay
            isVisible={isVisible}
            overlayStyle={styles.overlay}
            backdropStyle={styles.overlayBackdrop}
        >
            {!!title && <PWText variant='body'>{title}</PWText>}
            <ActivityIndicator
                size='large'
                color={theme.colors.linkPrimary}
                testID='activity-indicator'
            />
        </PWOverlay>
    )
}
