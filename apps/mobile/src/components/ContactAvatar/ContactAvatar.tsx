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

import type { Contact } from '@perawallet/wallet-core-contacts'
import { PWIcon, type PWIconSize, PWImage, PWView } from '@components/core'
import { useStyles, type ContactAvatarVariant } from './styles'

const placeholderIconSize = {
    xs: 'xs',
    sm: 'xs',
    md: 'md',
    lg: 'md',
    xl: 'lg',
    xxl: 'xl',
    '3xl': 'xxl',
} as const satisfies Record<PWIconSize, PWIconSize>

export type ContactAvatarProps = {
    size: PWIconSize
    contact?: Contact
    variant?: ContactAvatarVariant
}

export const ContactAvatar = ({
    size,
    contact,
    variant = 'default',
}: ContactAvatarProps) => {
    const styles = useStyles({ size, variant })

    return (
        <PWView style={styles.container}>
            {contact?.image ? (
                <PWImage
                    source={{ uri: contact.image }}
                    style={styles.image}
                    resizeMode='cover'
                />
            ) : (
                <PWIcon
                    name='person'
                    size={placeholderIconSize[size]}
                    variant={variant === 'highlighted' ? 'white' : 'secondary'}
                />
            )}
        </PWView>
    )
}
