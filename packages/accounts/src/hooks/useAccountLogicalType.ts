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

import { useAllAccountLogicalTypes } from './useAllAccountLogicalTypes'
import type { AccountLogicalType } from '../logical-type'

export const useAccountLogicalType = (
    address: string | undefined | null,
): AccountLogicalType | null => {
    const map = useAllAccountLogicalTypes()
    return address ? (map.get(address) ?? null) : null
}
