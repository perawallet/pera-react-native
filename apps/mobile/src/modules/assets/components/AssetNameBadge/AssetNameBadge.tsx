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

import { useMemo } from 'react'
import type { StyleProp, TextStyle } from 'react-native'

import { PWIcon, PWText, PWView } from '@components/core'
import type { TypographyVariant } from '@theme/typography'
import { getVerificationIcon } from '../../utils/verification'
import { useStyles } from './styles'

export type AssetNameBadgeProps = {
    name: string
    verificationTier?: string
    isFavorited?: boolean
    textVariant?: TypographyVariant
    textStyle?: StyleProp<TextStyle>
    numberOfLines?: number
}

export const AssetNameBadge = ({
    name,
    verificationTier,
    isFavorited,
    textVariant = 'h4',
    textStyle,
    numberOfLines = 1,
}: AssetNameBadgeProps) => {
    const styles = useStyles()

    const verificationIconName = useMemo(() => {
        return verificationTier ? getVerificationIcon(verificationTier) : null
    }, [verificationTier])

    return (
        <PWView style={styles.container}>
            <PWText
                variant={textVariant}
                style={[styles.name, textStyle]}
                numberOfLines={numberOfLines}
            >
                {name}
            </PWText>
            {isFavorited ? (
                <PWIcon
                    name='star-filled'
                    size='xs'
                    variant='favorite'
                />
            ) : null}
            {verificationIconName ? (
                <PWIcon
                    name={verificationIconName}
                    size='xs'
                />
            ) : null}
        </PWView>
    )
}
