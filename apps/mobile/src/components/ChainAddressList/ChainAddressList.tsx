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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useStyles } from './styles'

export type ChainAddress = {
    chainId: ChainId
    displayName: string
    /** Truncated by the chain's codec. */
    address: string
    /** Normalized by the chain's codec when it parses; see `chainAddressCopyValue`. */
    copyValue: string
}

export type ChainAddressListProps = {
    chains: ChainAddress[]
    style?: StyleProp<ViewStyle>
    /** Each row is `${testIDPrefix}_${chainId}`. */
    testIDPrefix: string
}

export const ChainAddressList = ({
    chains,
    style,
    testIDPrefix,
}: ChainAddressListProps) => {
    const styles = useStyles()

    return (
        <PWView style={[styles.panel, style]}>
            {chains.map(chain => (
                <CopyableText
                    key={chain.chainId}
                    copyValue={chain.copyValue}
                    style={styles.row}
                    testID={`${testIDPrefix}_${chain.chainId}`}
                >
                    <PWText
                        variant='body'
                        style={styles.chainName}
                    >
                        {chain.displayName}
                    </PWText>
                    <PWText variant='body'>{chain.address}</PWText>
                </CopyableText>
            ))}
        </PWView>
    )
}
