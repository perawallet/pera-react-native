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
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import { useChainIcon } from './useChainIcon'

const DEFAULT_SIZE = 24

export type ChainIconProps = {
    chainId: ChainId
    size?: number
}

export const ChainIcon = ({ chainId, size = DEFAULT_SIZE }: ChainIconProps) => {
    const { Icon, initials, displayName } = useChainIcon(chainId)
    const styles = useStyles(size)

    if (Icon) {
        return (
            <Icon
                width={size}
                height={size}
                accessibilityLabel={displayName}
                testID={`chain_icon_${chainId}`}
            />
        )
    }
    return (
        <PWView
            style={styles.placeholder}
            accessibilityLabel={displayName}
            testID={`chain_icon_${chainId}`}
        >
            <PWText
                variant='captionSmall'
                style={styles.initials}
            >
                {initials}
            </PWText>
        </PWView>
    )
}
