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

import { createContext, useContext } from 'react'
import { type SharedValue } from 'react-native-reanimated'
import { type Nullable } from '@perawallet/wallet-core-shared'

export type AccountDrawerContextValue = {
    isOpen: boolean
    openDrawer: () => void
    closeDrawer: () => void
    /**
     * 0-1 open progress. Published so a pager on the same screen can drive the
     * drawer from its own pan instead of running a competing one — see PWPager.
     */
    progress: SharedValue<number>
}

export const AccountDrawerContext =
    createContext<Nullable<AccountDrawerContextValue>>(null)

/**
 * `null` wherever no drawer is mounted — which is how the account-selection
 * trigger decides between opening the drawer and falling back to the bottom
 * sheet, rather than each call site knowing where it sits.
 */
export const useAccountDrawerControls =
    (): Nullable<AccountDrawerContextValue> => useContext(AccountDrawerContext)
