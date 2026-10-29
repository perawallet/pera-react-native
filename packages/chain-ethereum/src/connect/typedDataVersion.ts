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

import { isRecord } from '../signing/adapter'

// Shape only, never JSON.parse: this runs before the size caps in
// messageParams.ts. v1 is [typedDataArray, address]; v3 and v4 are
// [address, typedData], so only the second positional can be a v4 object.
export const isTypedDataV4Params = (params: unknown): boolean => {
    if (!Array.isArray(params)) return false
    const positional: unknown[] = params
    const typedData = positional[1]
    if (typeof typedData === 'string') return /^\s*\{/.test(typedData)
    return isRecord(typedData) && !Array.isArray(typedData)
}
