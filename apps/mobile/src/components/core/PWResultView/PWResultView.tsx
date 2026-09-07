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

import type { ReactNode } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PWButton } from '@components/core/PWButton'
import { PWIcon, type IconName } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { usePWResultView } from './usePWResultView'

export type PWResultViewVariant = 'error' | 'success' | 'warning'

export type PWResultViewAction = {
    label: string
    onPress: () => void
    isLoading?: boolean
    isDisabled?: boolean
}

export type PWResultViewProps = {
    variant: PWResultViewVariant
    title: string
    body?: string
    icon?: IconName
    primaryAction?: PWResultViewAction
    secondaryAction?: PWResultViewAction
    linkAction?: PWResultViewAction
    children?: ReactNode
    testID?: string
}

export const PWResultView = ({
    variant,
    title,
    body,
    icon,
    primaryAction,
    secondaryAction,
    linkAction,
    children,
    testID = 'pw-result-view',
}: PWResultViewProps) => {
    const styles = useStyles({ variant })
    const { iconName } = usePWResultView({ variant, icon })

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
            {(linkAction || primaryAction || secondaryAction) && (
                <SafeAreaView
                    edges={['bottom']}
                    style={styles.footer}
                >
                    {linkAction && (
                        <PWButton
                            variant='link'
                            paddingStyle='none'
                            title={linkAction.label}
                            onPress={linkAction.onPress}
                            isLoading={linkAction.isLoading}
                            isDisabled={linkAction.isDisabled}
                            testID={`${testID}-link`}
                        />
                    )}
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
                </SafeAreaView>
            )}
        </PWView>
    )
}
