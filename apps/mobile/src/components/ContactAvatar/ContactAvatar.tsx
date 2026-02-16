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

import { Contact } from '@perawallet/wallet-core-contacts'
import { useTheme } from '@rneui/themed'
import { PWIcon, PWIconSize, PWImage, PWView } from '@components/core'
import { SvgProps } from 'react-native-svg'
import { useStyles } from './styles'

export type ContactAvatarProps = {
    size: PWIconSize
    contact?: Contact
} & SvgProps

export const ContactAvatar = ({
    size,
    contact,
    ...rest
}: ContactAvatarProps) => {
    const { theme } = useTheme()

    const containerSizeMap: Record<PWIconSize, number> = {
        xs: theme.spacing.lg,
        sm: theme.spacing.xl,
        md: theme.spacing.xxl,
        lg: theme.spacing['3xl'],
        xl: theme.spacing['4xl'],
        xxl: theme.spacing['5xl'],
    }

    const sizeMap: Record<PWIconSize, number> = {
        xs: theme.spacing.md,
        sm: theme.spacing.lg,
        md: theme.spacing.xl,
        lg: theme.spacing.xxl,
        xl: theme.spacing['3xl'],
        xxl: theme.spacing['4xl'],
    }
    const dimensions = containerSizeMap[size]
    const imageSize = sizeMap[size]
    const styles = useStyles({ containerSize: dimensions, imageSize })

    return (
        <PWView style={styles.container}>
            {!!contact?.image && (
                <PWImage
                    source={{ uri: contact.image }}
                    style={styles.image}
                    width={imageSize}
                    height={imageSize}
                />
            )}
            {!contact?.image && (
                <PWIcon
                    {...rest}
                    name='person'
                    size={size}
                    variant='secondary'
                />
            )}
        </PWView>
    )
}
