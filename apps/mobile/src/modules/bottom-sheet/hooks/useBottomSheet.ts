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

import { useBottomSheetStore } from '../store/bottomSheetStore'
import type {
    BottomSheetOptions,
    BottomSheetRegistry,
    BottomSheetRequest,
} from '../types'

type UseBottomSheetResult = {
    request: <T = unknown>(req: BottomSheetRequest) => Promise<T | undefined>
    requestByType: <K extends keyof BottomSheetRegistry, T = unknown>(
        type: K,
        props: BottomSheetRegistry[K],
        options?: BottomSheetOptions,
    ) => Promise<T | undefined>
    dismiss: (id?: string) => void
    dismissAll: () => void
}

export const useBottomSheet = (): UseBottomSheetResult => {
    const request = useBottomSheetStore(s => s.request)
    const requestByType = useBottomSheetStore(s => s.requestByType)
    const dismiss = useBottomSheetStore(s => s.dismiss)
    const dismissAll = useBottomSheetStore(s => s.dismissAll)
    return { request, requestByType, dismiss, dismissAll }
}
