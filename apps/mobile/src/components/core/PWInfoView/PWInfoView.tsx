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

import type { ComponentType, ReactNode } from 'react'
import { useTheme } from '@rneui/themed'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PWButton } from '@components/core/PWButton'
import { PWScrollView } from '@components/core/PWScrollView'
import { PWText } from '@components/core/PWText'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'

/** Default illustration size; callers pass the icon and PWInfoView sizes it. */
const ILLUSTRATION_SIZE = 160

/**
 * Illustration contract: an SVG icon (or image wrapper) accepting a size and
 * optional tint. PWInfoView renders it at the default size, tinted `textMain`.
 */
export type PWInfoViewIllustration = ComponentType<{
    width: number
    height: number
    color?: string
}>

export type PWInfoViewAction = {
    label: string
    onPress: () => void
    isLoading?: boolean
    isDisabled?: boolean
    testID?: string
}

export type PWInfoViewProps = {
    illustration?: PWInfoViewIllustration
    title: string
    body: string
    /**
     * Optional slot rendered in the footer above the primary action (e.g. a
     * warning row or a compliance message). Use this for anything that needs
     * to sit between the content and the button stack.
     */
    footerExtras?: ReactNode
    primaryAction: PWInfoViewAction
    secondaryAction?: PWInfoViewAction
    testID?: string
}

export const PWInfoView = ({
    illustration: Illustration,
    title,
    body,
    footerExtras,
    primaryAction,
    secondaryAction,
    testID = 'pw-info-view',
}: PWInfoViewProps) => {
    const styles = useStyles()
    const { theme } = useTheme()

    return (
        <PWView
            style={styles.root}
            testID={testID}
        >
            <PWScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
            >
                {Illustration ? (
                    <Illustration
                        width={ILLUSTRATION_SIZE}
                        height={ILLUSTRATION_SIZE}
                        color={theme.colors.textMain}
                    />
                ) : null}
                <PWText variant='h1'>{title}</PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {body}
                </PWText>
            </PWScrollView>

            <SafeAreaView
                edges={['bottom']}
                style={styles.footer}
            >
                {footerExtras}
                <PWButton
                    variant='primary'
                    title={primaryAction.label}
                    onPress={primaryAction.onPress}
                    isLoading={primaryAction.isLoading}
                    isDisabled={primaryAction.isDisabled}
                    testID={primaryAction.testID ?? `${testID}-primary`}
                />
                {secondaryAction && (
                    <PWButton
                        variant='secondary'
                        title={secondaryAction.label}
                        onPress={secondaryAction.onPress}
                        isLoading={secondaryAction.isLoading}
                        isDisabled={secondaryAction.isDisabled}
                        testID={secondaryAction.testID ?? `${testID}-secondary`}
                    />
                )}
            </SafeAreaView>
        </PWView>
    )
}
