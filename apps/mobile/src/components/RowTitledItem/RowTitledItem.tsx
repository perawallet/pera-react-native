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

import { PWText, PWView, PWViewProps } from '@components/core'
import { useStyles } from './styles'

/**
 * Props for the RowTitledItem component.
 */
export type RowTitledItemProps = {
    /** Title label to display on the left */
    title: string
    /** Vertical alignment of the title and content */
    verticalAlignment?: 'center' | 'top'
} & PWViewProps

/**
 * A horizontal layout component typically used in lists.
 * Shows a title label on the left and wraps its children on the right.
 *
 * @example
 * <RowTitledItem title="Asset Name">
 *   <PWText>Algorand</PWText>
 * </RowTitledItem>
 */
export const RowTitledItem = (props: RowTitledItemProps) => {
    const { title, children, ...rest } = props
    const styles = useStyles(props)
    return (
        <PWView
            {...rest}
            style={[rest.style, styles.container]}
        >
            <PWText style={styles.label}>{title}</PWText>
            <PWView style={styles.childContainer}>{children}</PWView>
        </PWView>
    )
}
