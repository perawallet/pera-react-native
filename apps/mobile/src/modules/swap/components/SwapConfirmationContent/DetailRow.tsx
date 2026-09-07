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

import { PWText, PWView } from '@components/core'
import { InfoButton } from '@components/InfoButton/InfoButton'
import { useStyles } from './styles'

type DetailRowProps = {
    label: string
    value?: string
    valueStyle?: object
    info?: string
    /**
     * Applied to the value text, not the row: the label is already matchable by
     * its text, while the value is what an assertion needs to read. Rows that
     * pass `children` set the id on their own text node instead — a PWView
     * wrapper is accessible:false, so on Android it exposes no content-desc.
     */
    testID?: string
    children?: React.ReactNode
}

export const DetailRow = ({
    label,
    value,
    valueStyle,
    info,
    testID,
    children,
}: DetailRowProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.detailRow}>
            <PWView style={styles.detailLabelRow}>
                <PWText style={styles.detailLabel}>{label}</PWText>
                {info && (
                    <InfoButton size='xs'>
                        <PWText>{info}</PWText>
                    </InfoButton>
                )}
            </PWView>
            {children ?? (
                <PWText
                    style={valueStyle}
                    testID={testID}
                >
                    {value}
                </PWText>
            )}
        </PWView>
    )
}
