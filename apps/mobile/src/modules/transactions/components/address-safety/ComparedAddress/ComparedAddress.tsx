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
import type { AddressSegment } from '../../../utils/diffAddresses'
import { useStyles } from './styles'

export type ComparedAddressProps = {
    label: string
    segments: AddressSegment[]
    testID: string
}

export const ComparedAddress = ({
    label,
    segments,
    testID,
}: ComparedAddressProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.comparison}>
            <PWText
                variant='caption'
                style={styles.label}
            >
                {label}
            </PWText>
            <PWText
                style={styles.address}
                testID={testID}
            >
                {segments.map((segment, index) => (
                    <PWText
                        key={index}
                        weight={segment.isDifferent ? 700 : undefined}
                        style={
                            segment.isDifferent
                                ? styles.difference
                                : styles.address
                        }
                    >
                        {segment.text}
                    </PWText>
                ))}
            </PWText>
        </PWView>
    )
}
