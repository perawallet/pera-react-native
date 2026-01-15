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
import { Image, useTheme } from '@rneui/themed'
import { SvgProps } from 'react-native-svg'
import { useStyles } from './styles'
import { PWView } from '../PWView'
import { PWIcon } from '../PWIcon'

type ContactAvatarProps = {
    size: 'small' | 'large'
    contact?: Contact
} & SvgProps

export const ContactAvatar = ({
    size,
    contact,
    ...rest
}: ContactAvatarProps) => {
    const { theme } = useTheme()
    const dimensions =
        size === 'small' ? theme.spacing.xl : theme.spacing['4xl']
    const imageSize = size === 'small' ? theme.spacing.lg : theme.spacing['3xl']
    const iconSize = size === 'small' ? 'sm' : 'lg'
    const styles = useStyles({ containerSize: dimensions, imageSize })

    return (
        <PWView style={styles.container}>
            {!!contact?.image && (
                <Image
                    source={{ uri: contact.image }}
                    style={styles.image}
                />
            )}
            {!contact?.image && (
                <PWIcon
                    {...rest}
                    name='person'
                    size={iconSize}
                    variant='secondary'
                />
            )}
        </PWView>
    )
}
