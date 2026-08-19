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

import { type Decimal } from 'decimal.js'
import {
    type PeraAsset,
    type PeraCollectible,
} from '@perawallet/wallet-core-assets'
import {
    type GestureResponderEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native'

export type CollectibleDisplayItem = {
    assetId: string
    asset: PeraAsset
    collectible?: PeraCollectible
    amount: Decimal
}

export type CollectibleItemProps = {
    item: CollectibleDisplayItem
    onPress?: (event: GestureResponderEvent) => void
    /** Row style from the parent list (e.g. shared horizontal padding) so a
     *  collectible row lines up with the fungible rows beside it. */
    style?: StyleProp<ViewStyle>
    /** Marks a holding-level frozen collectible (selection contexts). */
    showFrozenBadge?: boolean
}
