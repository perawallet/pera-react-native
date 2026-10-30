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

// A separate entry so ChainIcon gets the logo without chain-ui.ts's transaction UI.
import type { ComponentType } from 'react'
import type { SvgProps } from 'react-native-svg'
import AlgoAssetIcon from '@assets/icons/assets/algo.svg'

export const algorandChainIcon = (): ComponentType<SvgProps> => AlgoAssetIcon

export const algorandNativeAssetIcon = (): ComponentType<SvgProps> =>
    AlgoAssetIcon

// U+00A6, which the bundled DMSans draws as the Algo mark.
// oxlint-disable-next-line pera/no-hardcoded-ui-strings -- Algo is a brand name, never translated
export const algorandNativeAssetGlyph = { glyph: '¦', label: 'Algo' }
