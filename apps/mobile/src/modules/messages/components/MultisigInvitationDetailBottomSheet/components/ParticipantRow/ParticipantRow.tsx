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

import { PWIcon, PWText, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useStyles } from './styles'
import { useParticipantRow } from './useParticipantRow'

export type ParticipantRowProps = {
    address: string
    isLast?: boolean
    testID?: string
}

export const ParticipantRow = ({
    address,
    isLast = false,
    testID,
}: ParticipantRowProps) => {
    const styles = useStyles({ isLast })
    const { avatarIcon, primaryText, secondaryText, onCopy } =
        useParticipantRow(address)

    return (
        <CopyableText
            copyValue={address}
            style={styles.row}
            testID={testID}
        >
            <PWIcon
                name={avatarIcon}
                size='lg'
            />
            <PWView style={styles.textContainer}>
                <PWText
                    variant='h4'
                    numberOfLines={1}
                    ellipsizeMode='middle'
                >
                    {primaryText}
                </PWText>
                {!!secondaryText && (
                    <PWText
                        variant='caption'
                        style={styles.secondary}
                        numberOfLines={1}
                        ellipsizeMode='middle'
                    >
                        {secondaryText}
                    </PWText>
                )}
            </PWView>
            <PWIcon
                name='copy'
                size='sm'
                variant='secondary'
                onPress={onCopy}
            />
        </CopyableText>
    )
}
