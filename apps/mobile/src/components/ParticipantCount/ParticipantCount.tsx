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

import { PWIcon, PWText, PWView } from '@components/core'
import { useStyles } from './styles'

type ParticipantCountSize = 'h1' | 'h2'

export type ParticipantCountProps = {
    count: number
    size?: ParticipantCountSize
    testID?: string
}

export const ParticipantCount = ({
    count,
    size = 'h2',
    testID,
}: ParticipantCountProps) => {
    const styles = useStyles({ size })

    return (
        <PWView style={styles.container}>
            <PWIcon
                name='people'
                variant='secondary'
                size='lg'
            />
            <PWText
                variant={size}
                style={styles.value}
                testID={testID}
                accessibilityLabel={
                    testID !== undefined ? String(count) : undefined
                }
            >
                {count}
            </PWText>
        </PWView>
    )
}
