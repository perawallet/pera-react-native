/*
 Copyright 2022-2025 Pera Wallet, LDA
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

/**
 * True when the sheet's content is wrapped in `PWBottomSheet`'s auto-created
 * `BottomSheetView` (i.e. `autoCreateContainer` was left at its default of
 * `true`). Components that own their own scroll container — `PWSheetLayout`,
 * `PWFlatList`/`PWScrollView` with `inBottomSheet` — read this to warn loudly
 * in dev when they'd otherwise be silently un-scrollable, nested inside the
 * content-sized `BottomSheetView`. The fix is to open the sheet with
 * `autoCreateContainer={false}`.
 */
export const AutoCreatedContainerContext = createContext(false)
