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

import { type ReactNode } from 'react'
import { PWIcon, type IconName } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'
import { PWView, type PWViewProps } from '@components/core/PWView'
import { LoadingView } from '@components/LoadingView'
import { useStyles } from './styles'
import { type ViewStyle } from 'react-native'

export type EmptyViewProps = {
    title?: string
    body: string
    icon?: IconName
    button?: React.ReactElement<unknown>
    isLoading?: boolean
    loadingView?: ReactNode
    loadingStyle?: ViewStyle
    /** Set false when the body is full-sentence copy the user must read in full; the default 3-line cap ellipsizes anything longer. */
    shouldTruncateBody?: boolean
} & PWViewProps

export const EmptyView = (props: EmptyViewProps) => {
    const styles = useStyles()
    const {
        title,
        body,
        icon,
        style,
        button,
        isLoading,
        loadingView,
        loadingStyle,
        shouldTruncateBody = true,
        ...rest
    } = props

    if (isLoading) {
        if (loadingView) {
            return <>{loadingView}</>
        }
        return (
            <LoadingView
                variant='skeleton'
                size='sm'
                count={5}
                style={loadingStyle}
            />
        )
    }

    return (
        <PWView
            {...rest}
            style={[styles.container, style]}
        >
            <PWView style={styles.content}>
                {!!icon && (
                    <PWView style={styles.iconContainer}>
                        <PWIcon
                            name={icon}
                            variant='secondary'
                            size='xl'
                        />
                    </PWView>
                )}
                {!!title && (
                    <PWText
                        variant='h3'
                        style={styles.titleText}
                        numberOfLines={2}
                        truncate
                    >
                        {title}
                    </PWText>
                )}
                <PWText
                    variant='body'
                    style={styles.text}
                    numberOfLines={shouldTruncateBody ? 3 : undefined}
                    truncate={shouldTruncateBody}
                >
                    {body}
                </PWText>
                {button}
            </PWView>
        </PWView>
    )
}
