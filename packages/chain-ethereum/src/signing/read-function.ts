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

import {
    decodeFunctionData,
    encodeFunctionData,
    size,
    slice,
    toFunctionSelector,
} from 'viem'
import type { AbiFunction, Hex } from 'viem'
import type { Optional } from '@perawallet/wallet-core-shared'

const SELECTOR_SIZE = 4

// A lenient decoder would accept dirty padding or trailing bytes the contract
// might read differently, so the call must re-encode to exactly its calldata.
export const readFunction = (
    functions: readonly AbiFunction[],
    data: Hex,
): Optional<{ name: string; args: readonly unknown[] }> => {
    if (size(data) < SELECTOR_SIZE) return undefined
    const selector = slice(data, 0, SELECTOR_SIZE).toLowerCase()
    const item = functions.find(
        candidate => toFunctionSelector(candidate) === selector,
    )
    if (!item) return undefined
    const { args = [] } = decodeFunctionData({ abi: [item], data })
    const encoded = encodeFunctionData({ abi: [item], args })
    return encoded.toLowerCase() === data.toLowerCase()
        ? { name: item.name, args }
        : undefined
}
