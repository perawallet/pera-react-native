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

import type { ReactNode } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { PWListItemLayout, PWText } from '@components/core'
import { ChainIcon } from '../ChainIcon'
import { useStyles } from './styles'

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: chain row icon size
const CHAIN_ICON_SIZE = 40

export type ChainRowProps = {
    chainId: ChainId
    /** Defaults to the chain's display name. */
    title?: string
    subtitle?: string
    right?: ReactNode
    onPress?: () => void
    testID?: string
}

/** One network as a bordered card: icon, name, an optional address or note, and a trailing slot. */
export const ChainRow = ({
    chainId,
    title,
    subtitle,
    right,
    onPress,
    testID,
}: ChainRowProps) => {
    const styles = useStyles()

    return (
        <PWListItemLayout
            style={styles.row}
            left={
                <ChainIcon
                    chainId={chainId}
                    size={CHAIN_ICON_SIZE}
                />
            }
            right={right}
            onPress={onPress}
            testID={testID}
        >
            <PWText style={styles.title}>
                {title ?? chainDisplayNameOf(chainId) ?? chainId}
            </PWText>
            {subtitle ? (
                <PWText
                    variant='caption'
                    style={styles.subtitle}
                >
                    {subtitle}
                </PWText>
            ) : null}
        </PWListItemLayout>
    )
}
