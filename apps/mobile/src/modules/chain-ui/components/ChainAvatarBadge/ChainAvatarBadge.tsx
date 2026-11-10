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

import { useTheme } from '@rneui/themed'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getIconPixelSize, PWImage, PWView } from '@components/core'
import { ChainIcon } from '../ChainIcon'
import { useStyles } from './styles'

export type ChainAvatarBadgeProps = {
    /** `left` is for an account avatar, whose right corner holds its backup badge. */
    corner?: 'left' | 'right'
    testID?: string
} & (
    | { chainId: ChainId; logoUrl?: never }
    /** A network the wallet doesn't run has no icon of its own, so it is drawn from a URL. */
    | { logoUrl: string; chainId?: never }
)

/** Pins a network's icon to a bottom corner of its parent avatar. */
export const ChainAvatarBadge = ({
    chainId,
    logoUrl,
    corner = 'right',
    testID,
}: ChainAvatarBadgeProps) => {
    const { theme } = useTheme()
    const size = getIconPixelSize(theme, 'sm')
    const styles = useStyles(size)

    return (
        <PWView
            style={[
                styles.badge,
                corner === 'left' ? styles.left : styles.right,
            ]}
            testID={testID ?? `chain_avatar_badge_${chainId ?? 'logo'}`}
        >
            {chainId === undefined ? (
                <PWImage
                    source={{ uri: logoUrl }}
                    style={styles.logo}
                    showLoadingIndicator={false}
                />
            ) : (
                <ChainIcon
                    chainId={chainId}
                    size={size}
                />
            )}
        </PWView>
    )
}
