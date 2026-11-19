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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getInitials } from '@perawallet/wallet-core-shared'
import { PWImage, PWText, PWView } from '@components/core'
import { ChainIcon } from '../ChainIcon'
import { useStyles } from './styles'

export type NetworkIconProps = {
    /** A chain the wallet runs, drawn with its own icon. */
    chainId?: ChainId
    /** A network the wallet doesn't run, drawn from a URL. Ignored when `chainId` is set. */
    logoUrl?: string
    /** Its initials are drawn when there's neither a chain id nor a logo. */
    name?: string
    /** px */
    size: number
}

export const NetworkIcon = ({
    chainId,
    logoUrl,
    name,
    size,
}: NetworkIconProps) => {
    const styles = useStyles(size)

    if (chainId) {
        return (
            <ChainIcon
                chainId={chainId}
                size={size}
            />
        )
    }
    if (logoUrl) {
        return (
            <PWImage
                source={{ uri: logoUrl }}
                style={styles.logo}
                showLoadingIndicator={false}
            />
        )
    }
    if (name) {
        return (
            <PWView style={styles.placeholder}>
                <PWText
                    variant='captionSmall'
                    style={styles.initials}
                >
                    {getInitials(name)}
                </PWText>
            </PWView>
        )
    }
    return null
}
