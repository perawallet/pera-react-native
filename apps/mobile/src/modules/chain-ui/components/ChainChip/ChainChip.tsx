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
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { getIconPixelSize, PWText, PWView } from '@components/core'
import { ChainIcon } from '../ChainIcon'
import { useStyles } from './styles'

export type ChainChipProps = {
    chainId: ChainId
    /** Drops the pill, so the icon lines up with text beside it. */
    isBare?: boolean
    /** A bordered pill with the label in the main text color. */
    isOutlined?: boolean
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const ChainChip = ({
    chainId,
    isBare = false,
    isOutlined = false,
    style,
    testID,
}: ChainChipProps) => {
    const styles = useStyles()
    const { theme } = useTheme()

    return (
        <PWView
            style={[
                styles.container,
                !isBare && styles.pill,
                !isBare && isOutlined && styles.outlined,
                style,
            ]}
            testID={testID}
        >
            <ChainIcon
                chainId={chainId}
                size={getIconPixelSize(theme, 'sm')}
            />
            <PWText
                variant='body'
                style={[styles.label, isOutlined && styles.outlinedLabel]}
                numberOfLines={1}
            >
                {chainDisplayNameOf(chainId) ?? chainId}
            </PWText>
        </PWView>
    )
}
