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

import { useBottomSheetStore } from '../store/bottomSheetStore'
import type { InternalRequest } from '../types'

type UseBottomSheetStackResult = {
    requests: InternalRequest[]
    remove: (id: string) => void
    dismissAll: () => void
}

export const useBottomSheetStack = (): UseBottomSheetStackResult => {
    const requests = useBottomSheetStore(s => s.requests)
    const remove = useBottomSheetStore(s => s.remove)
    const dismissAll = useBottomSheetStore(s => s.dismissAll)
    return { requests, remove, dismissAll }
}
