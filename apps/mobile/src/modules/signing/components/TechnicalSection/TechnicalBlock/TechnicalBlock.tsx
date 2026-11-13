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
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'

export type TechnicalBlockProps = {
    label?: string
    /** One line on what the block is, under its label. */
    help?: string
    children?: ReactNode
    testID?: string
}

export const TechnicalBlock = ({
    label,
    help,
    children,
    testID,
}: TechnicalBlockProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.block}
            testID={testID}
        >
            {!!label && <PWText style={styles.label}>{label}</PWText>}
            {!!help && (
                <PWText
                    variant='captionMedium'
                    weight={400}
                    style={styles.label}
                >
                    {help}
                </PWText>
            )}
            {children}
        </PWView>
    )
}
