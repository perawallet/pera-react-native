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

import { PWText, PWView } from '@components/core'
import type { DiscoverFavorite } from '../../types'
import { dappLogoStack } from '../../utils/dappLogoStack'
import { DappLogo } from '../DappLogo'
import { useStyles } from './styles'

export type DappLogoStackProps = {
    /** The first dApps, in display order. */
    dapps: Pick<DiscoverFavorite, 'url' | 'logo'>[]
    /** Every dApp in the row, for the "+N" chip. */
    total: number
}

/** Up to three overlapped dApp logos and a "+N" chip, like `ChainIconStack`. */
export const DappLogoStack = ({ dapps, total }: DappLogoStackProps) => {
    const styles = useStyles()
    const { visible, hiddenCount } = dappLogoStack(dapps, total)
    if (visible.length === 0) return null

    return (
        <PWView
            style={styles.stack}
            testID='discover_logo_stack'
        >
            {visible.map((dapp, index) => (
                <PWView
                    key={dapp.url}
                    style={[styles.slot, index > 0 && styles.stacked]}
                    testID={`discover_logo_stack_logo_${index}`}
                >
                    <DappLogo
                        logo={dapp.logo}
                        size='stack'
                    />
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
