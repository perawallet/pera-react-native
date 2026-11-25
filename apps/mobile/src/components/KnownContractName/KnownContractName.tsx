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

import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { TypographyVariant } from '@theme/typography'
import { useStyles } from './styles'

export type KnownContractNameProps = {
    /** A proper noun from the known-contract registry or Pera's metadata, never translated. */
    name: string
    variant?: TypographyVariant
    style?: StyleProp<ViewStyle>
    textStyle?: StyleProp<TextStyle>
    testID?: string
    iconTestID?: string
    /** Cuts a name too long for the row to one line; off, it wraps. */
    shouldTruncate?: boolean
}

/** A contract Pera knows, by name with its check mark. */
export const KnownContractName = ({
    name,
    variant,
    style,
    textStyle,
    testID,
    iconTestID,
    shouldTruncate = false,
}: KnownContractNameProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={[styles.row, style]}
            testID={testID}
        >
            <PWText
                variant={variant}
                style={textStyle}
                truncate={shouldTruncate}
            >
                {name}
            </PWText>
            <PWIcon
                testID={iconTestID}
                name='check'
                size='sm'
                variant='positive'
                accessibilityLabel={t('ethereum.known_contract.badge')}
            />
        </PWView>
    )
}
