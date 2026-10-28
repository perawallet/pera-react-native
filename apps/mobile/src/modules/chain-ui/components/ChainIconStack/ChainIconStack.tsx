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
import { ChainIcon } from '../ChainIcon'
import { useChainIconStack } from './useChainIconStack'
import { CHAIN_ICON_SIZE, useStyles } from './styles'

export type ChainIconStackProps = {
    chainIds: ChainId[]
}

export const ChainIconStack = ({ chainIds }: ChainIconStackProps) => {
    const styles = useStyles()
    const { visibleChainIds, hiddenCount } = useChainIconStack(chainIds)

    return (
        <PWView style={styles.chainIconStack}>
            {visibleChainIds.map((chainId, index) => (
                <PWView
                    key={chainId}
                    testID={`chain_icon_stack_${chainId}`}
                    style={index > 0 && styles.stackedChainIcon}
                >
                    <ChainIcon
                        chainId={chainId}
                        size={CHAIN_ICON_SIZE}
                    />
                </PWView>
            ))}
            {hiddenCount > 0 && (
                <PWView
                    style={styles.stackedChainIcon}
                    testID='chain_icon_stack_more'
                >
                    <PWView style={styles.moreChains}>
                        <PWText
                            variant='captionMedium'
                            style={styles.moreChainsLabel}
                        >
                            {`+${hiddenCount}`}
                        </PWText>
                    </PWView>
                </PWView>
            )}
        </PWView>
    )
}
