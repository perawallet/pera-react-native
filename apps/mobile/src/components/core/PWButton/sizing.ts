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

import type { PWIconSize } from '@components/core/PWIcon'
import type { PWButtonProps } from './PWButton'

/**
 * Icon size for a button's padding style: dense/none buttons use the smaller
 * `sm` icon, everything else `md`. Shared by the rendered icons (PWButton) and
 * the loading-spinner box (styles) so they can't drift out of sync.
 */
export const getButtonIconSize = (
    paddingStyle: PWButtonProps['paddingStyle'],
): PWIconSize =>
    paddingStyle === 'dense' || paddingStyle === 'none' ? 'sm' : 'md'
