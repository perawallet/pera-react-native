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

import { PWView, PWIcon } from '@components/core'
import { useStyles } from './styles'

export type LedgerCompositeIconProps = {
    testID?: string
}

const DOT_COUNT = 4

export const LedgerCompositeIcon = ({
    testID,
}: LedgerCompositeIconProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWIcon
                name='phone-bluetooth'
                size='lg'
                testID={testID ? `${testID}-phone` : undefined}
            />
            <PWView
                style={styles.dots}
                testID={testID ? `${testID}-dots` : undefined}
            >
                {Array.from({ length: DOT_COUNT }).map((_, i) => (
                    <PWView
                        key={i}
                        style={styles.dot}
                    />
                ))}
            </PWView>
            <PWIcon
                name='ledger'
                size='lg'
                testID={testID ? `${testID}-ledger` : undefined}
            />
        </PWView>
    )
}
