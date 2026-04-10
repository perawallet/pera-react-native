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

import type { ComponentType } from 'react'
import type { BottomSheetOptions, InjectedSheetProps } from '../types'
import { useBottomSheetStore } from './useBottomSheetStore'

type UseBottomSheetResult = {
    openSheet: <P extends InjectedSheetProps>(
        component: ComponentType<P>,
        props: Omit<P, keyof InjectedSheetProps>,
        options?: BottomSheetOptions,
    ) => string
    closeSheet: (id: string) => void
    closeTopSheet: () => void
    closeAllSheets: () => void
}

export const useBottomSheet = (): UseBottomSheetResult => {
    const pushSheet = useBottomSheetStore(state => state.pushSheet)
    const removeSheet = useBottomSheetStore(state => state.removeSheet)
    const popSheet = useBottomSheetStore(state => state.popSheet)
    const clearSheets = useBottomSheetStore(state => state.clearSheets)

    return {
        openSheet: pushSheet,
        closeSheet: removeSheet,
        closeTopSheet: popSheet,
        closeAllSheets: clearSheets,
    }
}
