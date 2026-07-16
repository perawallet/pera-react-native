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

import { useCallback, useContext, useMemo } from 'react'

import { BottomSheetIdContext } from '../components/BottomSheetHost/BottomSheetIdContext'
import { useBottomSheetStore } from '../store/bottomSheetStore'

type UseBottomSheetResultHook<T> = {
    resolve: (value: T) => void
    dismiss: () => void
}

export const useBottomSheetResult = <
    T = unknown,
>(): UseBottomSheetResultHook<T> => {
    const id = useContext(BottomSheetIdContext)
    if (!id) {
        throw new Error(
            'useBottomSheetResult must be used inside a bottom sheet ' +
                'rendered by BottomSheetManager.',
        )
    }
    const storeResolve = useBottomSheetStore(s => s.resolve)
    const storeDismiss = useBottomSheetStore(s => s.dismiss)

    const resolve = useCallback(
        (value: T) => storeResolve(id, value),
        [storeResolve, id],
    )
    const dismiss = useCallback(() => storeDismiss(id), [storeDismiss, id])

    return useMemo(() => ({ resolve, dismiss }), [resolve, dismiss])
}
