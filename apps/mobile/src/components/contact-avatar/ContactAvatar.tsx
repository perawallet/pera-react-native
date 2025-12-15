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
import PWView from '../view/PWView'
import PWIcon from '../icons/PWIcon'

type ContactAvatarProps = {
    size: 'small' | 'large'
    contact?: Contact
} & SvgProps

const ContactAvatar = ({ size, contact, ...rest }: ContactAvatarProps) => {
    const { theme } = useTheme()
    const dimensions =
        size === 'small' ? theme.spacing.xl : theme.spacing.xl * 3
    const imageSize = size === 'small' ? theme.spacing.lg : theme.spacing.xl * 2
    const iconSize = size === 'small' ? 'sm' : 'lg'
    const styles = useStyles(dimensions)

    return (
        <PWView style={styles.container}>
            {!!contact?.image && (
                <Image
                    source={{ uri: contact.image }}
                    style={{ width: imageSize, height: imageSize }}
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

export default ContactAvatar
