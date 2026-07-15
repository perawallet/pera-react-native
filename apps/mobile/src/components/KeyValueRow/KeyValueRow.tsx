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

import {
    PWText,
    type PWTextProps,
    PWView,
    type PWViewProps,
} from '@components/core'
import { useStyles } from './styles'

export type KeyValueRowProps = {
    title: string
    titleProps?: PWTextProps
    verticalAlignment?: 'center' | 'top'
} & PWViewProps

export const KeyValueRow = (props: KeyValueRowProps) => {
    const { title, titleProps, children, ...rest } = props
    const styles = useStyles(props)
    return (
        <PWView
            {...rest}
            style={[rest.style, styles.container]}
        >
            <PWView style={styles.labelContainer}>
                <PWText
                    variant='bodyCompact'
                    style={styles.label}
                    truncate
                    {...titleProps}
                >
                    {title}
                </PWText>
            </PWView>
            <PWView style={styles.childContainer}>{children}</PWView>
        </PWView>
    )
}
