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
import {
    groupAddressSegments,
    type AddressSegment,
} from '@modules/transactions/utils/diffAddresses'
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
            <PWView
                style={styles.groups}
                testID={testID}
            >
                {groupAddressSegments(segments).map((group, groupIndex) => (
                    <PWText
                        key={groupIndex}
                        variant='mono'
                    >
                        {group.map((segment, index) => (
                            <PWText
                                key={index}
                                variant='mono'
                                style={
                                    segment.isDifferent
                                        ? styles.difference
                                        : undefined
                                }
                            >
                                {segment.text}
                            </PWText>
                        ))}
                    </PWText>
                ))}
            </PWView>
        </PWView>
    )
}
