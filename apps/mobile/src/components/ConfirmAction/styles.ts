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

import { CONTROL_MAX_WIDTH_DP } from '@constants/ui'

import type { ViewStyle } from 'react-native'

/**
 * Compose last onto a confirm control or the group it shares with its CTAs.
 * Full width on phones; on anything wider it caps and centers, so the
 * slide track never becomes a long drag and the buttons keep a button's
 * proportions. `width` is explicit because `alignSelf: 'center'` alone would
 * shrink the element to its content.
 */
export const CONFIRM_ACTION_LAYOUT: ViewStyle = {
    width: '100%',
    maxWidth: CONTROL_MAX_WIDTH_DP,
    alignSelf: 'center',
}
