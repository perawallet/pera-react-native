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

import { PWView } from '@components/core'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { useStyles } from './styles'
import { TokenIcon } from './TokenIcon'

export type OnrampAssetPairIconProps = {
    sourceToken: RampToken
    destinationToken: RampToken
    surfaceColor: string
}

// Source sits behind at the top-left; destination overlaps in front at the
// bottom-right with a surface-colored ring (matching the History design).
export const OnrampAssetPairIcon = ({
    sourceToken,
    destinationToken,
    surfaceColor,
}: OnrampAssetPairIconProps) => {
    const styles = useStyles({ surfaceColor })

    return (
        <PWView style={styles.container}>
            <PWView style={styles.sourceIcon}>
                <TokenIcon token={sourceToken} />
            </PWView>
            <PWView style={styles.destinationIcon}>
                <TokenIcon token={destinationToken} />
            </PWView>
        </PWView>
    )
}
