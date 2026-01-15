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

import { PWText } from '@components/core/PWText'
import { PWView, PWViewProps } from '@components/core/PWView'
import { useStyles } from './styles'
import { PWIcon, IconName } from '@components/core/PWIcon'

export type EmptyViewProps = {
    title?: string
    body: string
    icon?: IconName
    button?: React.ReactElement<unknown>
} & PWViewProps

export const EmptyView = (props: EmptyViewProps) => {
    const styles = useStyles()
    const { title, body, icon, style, button, ...rest } = props

    return (
        <PWView
            {...rest}
            style={[styles.container, style]}
        >
            {!!icon && (
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name={icon}
                        variant='secondary'
                        size='lg'
                    />
                </PWView>
            )}
            {!!title && (
                <PWText
                    variant='h3'
                    style={styles.text}
                >
                    {title}
                </PWText>
            )}
            <PWText style={styles.text}>{body}</PWText>
            {button}
        </PWView>
    )
}
