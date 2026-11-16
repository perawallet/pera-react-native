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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWIcon, PWImage, PWText, PWView } from '@components/core'
import { dappLogoStack } from '../../utils/dappLogoStack'
import { useStyles } from './styles'

export type DappLogoStackProps = {
    /** The first dApps' logos, in display order. */
    logos: Nullable<string>[]
    /** Every dApp in the row, for the "+N" chip. */
    total: number
}

/** Up to three overlapped dApp logos and a "+N" chip, like `ChainIconStack`. */
export const DappLogoStack = ({ logos, total }: DappLogoStackProps) => {
    const styles = useStyles()
    const { visible, hiddenCount } = dappLogoStack(logos, total)
    if (visible.length === 0) return null

    return (
        <PWView
            style={styles.stack}
            testID='discover_logo_stack'
        >
            {visible.map((logo, index) => (
                <PWView
                    // Logos repeat and can be null; the slot is the identity.
                    // oxlint-disable-next-line react/no-array-index-key -- fixed slots, never reordered in place
                    key={index}
                    style={[styles.slot, index > 0 && styles.stacked]}
                    testID={`discover_logo_stack_logo_${index}`}
                >
                    {logo ? (
                        <PWImage
                            source={{ uri: logo }}
                            style={styles.logo}
                        />
                    ) : (
                        <PWView style={styles.logo}>
                            <PWIcon
                                name='globe'
                                size='xs'
                                variant='secondary'
                            />
                        </PWView>
                    )}
                </PWView>
            ))}
            {hiddenCount > 0 ? (
                <PWView
                    style={[styles.slot, styles.stacked]}
                    testID='discover_logo_stack_more'
                >
                    <PWView style={styles.more}>
                        <PWText
                            variant='captionMedium'
                            style={styles.moreLabel}
                        >
                            {`+${hiddenCount}`}
                        </PWText>
                    </PWView>
                </PWView>
            ) : null}
        </PWView>
    )
}
