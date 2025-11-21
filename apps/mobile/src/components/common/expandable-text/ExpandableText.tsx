import { TextStyle, StyleProp } from 'react-native'
import { useState } from 'react'
import { useStyles } from './styles'
import PWButton from '../button/PWButton'
import { Text } from '@rneui/themed'

type ExpandableTextProps = {
    text: string
    limit?: number
    textStyle?: StyleProp<TextStyle>
    readMoreStyle?: StyleProp<TextStyle>
}

const ExpandableText = ({
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
            <Text style={[textStyle]}>{displayText}</Text>
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

export default ExpandableText
