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

import { createContext } from 'react'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PWBottomSheetSize } from './sheet-types'

/**
 * The size of the `PWBottomSheet` around this content; null outside a sheet.
 * `PWSheetLayout` reads it to pin its footer without clipping an `auto` sheet.
 */
export const PWSheetSizeContext =
    createContext<Nullable<PWBottomSheetSize>>(null)
