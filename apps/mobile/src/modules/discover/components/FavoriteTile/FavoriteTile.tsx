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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import type { DiscoverFavorite } from '../../types'
import { dappSubtitle } from '../../utils/dappSubtitle'
import { DappLogo } from '../DappLogo'
import { useStyles } from './styles'

export type FavoriteTileProps = {
    dapp: DiscoverFavorite
    onPress: () => void
    onLongPress?: () => void
    testID?: string
}

/** A favorite in the home grid: logo, name, category or domain. */
export const FavoriteTile = ({
    dapp,
    onPress,
    onLongPress,
    testID,
}: FavoriteTileProps) => {
    const styles = useStyles()
    return (
        <PWTouchableOpacity
            style={styles.tile}
            onPress={onPress}
            onLongPress={onLongPress}
            testID={testID}
        >
            <DappLogo
                logo={dapp.logo}
                size='tile'
                siteUrl={dapp.url}
            />
            <PWView style={styles.texts}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    numberOfLines={1}
                    style={styles.text}
                >
                    {dapp.name}
                </PWText>
                <PWText
                    variant='footnoteMedium'
                    weight={400}
                    numberOfLines={1}
                    style={[styles.text, styles.subtitle]}
                >
                    {dappSubtitle(dapp)}
                </PWText>
            </PWView>
        </PWTouchableOpacity>
    )
}
