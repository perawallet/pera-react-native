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

import type { EvmAbiValue } from '@perawallet/wallet-core-chain-ethereum'

export type EvmAbiLeafValue = Extract<
    EvmAbiValue,
    { kind: 'integer' | 'bool' | 'bytes' | 'string' }
>

// An integer is shown as the calldata encodes it: nothing says what unit it counts.
export const abiValueText = (value: EvmAbiLeafValue): string => {
    switch (value.kind) {
        case 'integer': {
            return value.value.toFixed()
        }
        case 'bool': {
            return String(value.value)
        }
        case 'bytes': {
            return value.value
        }
        case 'string': {
            return JSON.stringify(value.value)
        }
    }
}
