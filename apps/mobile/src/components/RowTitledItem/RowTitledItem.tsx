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

import PWView, { PWViewProps } from '../PWView'
import { useStyles } from './styles'
import { Text } from '@rneui/themed'

export type RowTitledItemProps = {
    title: string
    verticalAlignment?: 'center' | 'top'
} & PWViewProps

const RowTitledItem = (props: RowTitledItemProps) => {
    const { title, children, ...rest } = props
    const styles = useStyles(props)
    return (
        <PWView
            {...rest}
            style={[rest.style, styles.container]}
        >
            <Text style={styles.label}>{title}</Text>
            <PWView style={styles.childContainer}>{children}</PWView>
        </PWView>
    )
}

export default RowTitledItem
