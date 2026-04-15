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

import { ReactNode } from 'react'
import { PWButton } from '@components/core/PWButton'
import { PWIcon, IconName } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { usePWResultScreen } from './usePWResultScreen'

export type PWResultScreenVariant = 'error' | 'success' | 'warning'

export type PWResultScreenAction = {
    label: string
    onPress: () => void
    isLoading?: boolean
    isDisabled?: boolean
}

export type PWResultScreenProps = {
    variant: PWResultScreenVariant
    title: string
    body?: string
    /**
     * Optional override for the icon rendered inside the colored circle.
     * When omitted, a sensible default is picked per variant.
     */
    icon?: IconName
    primaryAction?: PWResultScreenAction
    secondaryAction?: PWResultScreenAction
    /**
     * Optional extra content rendered between the body and the action buttons
     * (for example, a transaction amount summary).
     */
    children?: ReactNode
    testID?: string
}

export const PWResultScreen = ({
    variant,
    title,
    body,
    icon,
    primaryAction,
    secondaryAction,
    children,
    testID = 'pw-result-screen',
}: PWResultScreenProps) => {
    const styles = useStyles({ variant })
    const { iconName } = usePWResultScreen({ variant, icon })

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWView style={styles.content}>
                <PWView style={styles.iconCircle}>
                    <PWIcon
                        name={iconName}
                        variant='white'
                        size='lg'
                    />
                </PWView>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {title}
                </PWText>
                {!!body && <PWText style={styles.body}>{body}</PWText>}
                {children}
            </PWView>
            {(primaryAction || secondaryAction) && (
                <PWView style={styles.footer}>
                    {primaryAction && (
                        <PWButton
                            variant='primary'
                            title={primaryAction.label}
                            onPress={primaryAction.onPress}
                            isLoading={primaryAction.isLoading}
                            isDisabled={primaryAction.isDisabled}
                            testID={`${testID}-primary`}
                        />
                    )}
                    {secondaryAction && (
                        <PWButton
                            variant='secondary'
                            title={secondaryAction.label}
                            onPress={secondaryAction.onPress}
                            isLoading={secondaryAction.isLoading}
                            isDisabled={secondaryAction.isDisabled}
                            testID={`${testID}-secondary`}
                        />
                    )}
                </PWView>
            )}
        </PWView>
    )
}
