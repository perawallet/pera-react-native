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

import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import { getInitials } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { ChainIcon } from '../ChainIcon'
import { useChainFamily } from '../../hooks/useChainFamily'
import { useStyles } from './styles'

const DEFAULT_SIZE = 24

export type ChainFamilyIconProps = {
    family: ChainFamily
    size?: number
}

export const ChainFamilyIcon = ({
    family,
    size = DEFAULT_SIZE,
}: ChainFamilyIconProps) => {
    const { label, leadChainId } = useChainFamily(family)
    const styles = useStyles(size)

    if (leadChainId) {
        return (
            <ChainIcon
                chainId={leadChainId}
                size={size}
            />
        )
    }
    return (
        <PWView
            style={styles.placeholder}
            accessibilityLabel={label}
            testID={`chain_family_icon_${family}`}
        >
            <PWText
                variant='captionSmall'
                style={styles.initials}
            >
                {getInitials(label)}
            </PWText>
        </PWView>
    )
}
