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

import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@rneui/themed'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getIconPixelSize, PWText, PWView } from '@components/core'
import { ChainIcon } from '@modules/chain-ui/icon'
import { useChainLabel } from './useChainLabel'
import { useStyles } from './styles'

const SIZES = {
    sm: { icon: 'xs', text: 'body' },
    md: { icon: 'sm', text: 'bodyLarge' },
} as const

export type ChainLabelProps = {
    chainId: ChainId
    size?: keyof typeof SIZES
    style?: StyleProp<ViewStyle>
}

export const ChainLabel = ({
    chainId,
    size = 'sm',
    style,
}: ChainLabelProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { label } = useChainLabel(chainId)

    return (
        <PWView
            style={[styles.container, style]}
            testID={`chain_label_${chainId}`}
        >
            <ChainIcon
                chainId={chainId}
                size={getIconPixelSize(theme, SIZES[size].icon)}
            />
            <PWText
                variant={SIZES[size].text}
                style={styles.label}
                numberOfLines={1}
            >
                {label}
            </PWText>
        </PWView>
    )
}
