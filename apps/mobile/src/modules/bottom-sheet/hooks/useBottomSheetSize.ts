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

import { useContext } from 'react'

import { BottomSheetIdContext } from '../components/BottomSheetHost/BottomSheetIdContext'
import { useBottomSheetStore } from '../store/bottomSheetStore'
import type { BottomSheetSize } from '../types'

/** Host sheet size (`full` | `modal` | `auto`); used by `SheetHeader`. */
export const useBottomSheetSize = (): BottomSheetSize | undefined => {
    const id = useContext(BottomSheetIdContext)
    return useBottomSheetStore(s =>
        id ? s.requests.find(r => r.id === id)?.options?.size : undefined,
    )
}
