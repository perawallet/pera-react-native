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

import { TextStyle, StyleProp } from 'react-native'
import { useState } from 'react'
import { PWButton } from '../PWButton'
import { Text } from '@rneui/themed'

type ExpandableTextProps = {
    text: string
    limit?: number
    textStyle?: StyleProp<TextStyle>
    readMoreStyle?: StyleProp<TextStyle>
}

export const ExpandableText = ({
    text,
    limit = 150,
    textStyle,
}: ExpandableTextProps) => {
    const [isExpanded, setIsExpanded] = useState(false)

    if (!text) {
        return null
    }

    const shouldTruncate = text.length > limit
    const displayText =
        shouldTruncate && !isExpanded ? `${text.slice(0, limit)}...` : text

    return (
        <>
            <Text style={textStyle}>{displayText}</Text>
            {shouldTruncate && (
                <PWButton
                    title={isExpanded ? 'Show less' : 'Show more'}
                    onPress={() => setIsExpanded(!isExpanded)}
                    variant='link'
                />
            )}
        </>
    )
}
