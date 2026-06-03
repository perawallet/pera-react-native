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

import { PWText, PWView } from '@components/core'
import { useStyles } from '../styles'
import { formatDebugValue } from '../utils/formatDebugValue'

type LegacyVsRnRowProps = {
    label: string
    legacyValue: unknown
    rnValue: unknown
    matches?: boolean
}

export const LegacyVsRnRow = ({
    label,
    legacyValue,
    rnValue,
    matches,
}: LegacyVsRnRowProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.comparisonRow}>
            <PWView style={styles.comparisonHeader}>
                <PWText
                    variant='body'
                    style={styles.comparisonLabel}
                >
                    {label}
                </PWText>
                {matches !== undefined && (
                    <PWText
                        variant='body'
                        style={[
                            styles.comparisonStatus,
                            matches
                                ? styles.comparisonStatusOk
                                : styles.comparisonStatusWarn,
                        ]}
                    >
                        {matches ? '✓' : '⚠'}
                    </PWText>
                )}
            </PWView>
            <PWView style={styles.comparisonLine}>
                <PWText
                    variant='body'
                    style={styles.comparisonTag}
                >
                    Device
                </PWText>
                <PWText
                    variant='body'
                    style={styles.comparisonValue}
                >
                    {formatDebugValue(legacyValue)}
                </PWText>
            </PWView>
            <PWView style={styles.comparisonLine}>
                <PWText
                    variant='body'
                    style={styles.comparisonTag}
                >
                    RN
                </PWText>
                <PWText
                    variant='body'
                    style={styles.comparisonValue}
                >
                    {formatDebugValue(rnValue)}
                </PWText>
            </PWView>
        </PWView>
    )
}
