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
import { useStyles } from './styles'

export type NumberedListProps = {
    items: string[]
    testID?: string
}

export const NumberedList = ({
    items,
    testID = 'numbered-list',
}: NumberedListProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            {items.map((text, index) => (
                <PWView
                    key={`${index}-${text}`}
                    style={styles.row}
                >
                    <PWView style={styles.bullet}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.bulletText}
                        >
                            {String(index + 1)}
                        </PWText>
                    </PWView>
                    <PWText
                        variant='bodyLarge'
                        style={styles.itemText}
                    >
                        {text}
                    </PWText>
                </PWView>
            ))}
        </PWView>
    )
}
