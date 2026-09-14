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
import type { TypographyVariant } from '@theme/typography'
import { useStyles } from './styles'

export type NumberedListItem = string | { title: string; description: string }

export type NumberedListProps = {
    items: NumberedListItem[]
    /** Item text size. Defaults to `bodyLarge`. */
    textVariant?: TypographyVariant
    isDense?: boolean
    testID?: string
}

/** Vertical list of steps, each prefixed by a circled number. */
export const NumberedList = ({
    items,
    textVariant = 'bodyLarge',
    isDense = false,
    testID = 'numbered-list',
}: NumberedListProps) => {
    const styles = useStyles({ isDense })

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            {items.map((item, index) => {
                const isDetailed = typeof item !== 'string'
                const label = isDetailed ? item.title : item

                return (
                    <PWView
                        key={`${index}-${label}`}
                        style={[styles.row, isDetailed && styles.detailedRow]}
                    >
                        <PWView style={styles.bullet}>
                            <PWText
                                variant='bodyLarge'
                                style={styles.bulletText}
                            >
                                {String(index + 1)}
                            </PWText>
                        </PWView>
                        {isDetailed ? (
                            <PWView style={styles.detailedBody}>
                                <PWText
                                    variant={textVariant}
                                    weight={500}
                                    style={styles.itemText}
                                >
                                    {item.title}
                                </PWText>
                                <PWText
                                    variant={textVariant}
                                    style={styles.itemDescription}
                                >
                                    {item.description}
                                </PWText>
                            </PWView>
                        ) : (
                            <PWText
                                variant={textVariant}
                                style={styles.itemText}
                            >
                                {item}
                            </PWText>
                        )}
                    </PWView>
                )
            })}
        </PWView>
    )
}
