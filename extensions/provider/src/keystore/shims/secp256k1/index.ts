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

import { tagShim, type SubtleShim } from '@algorandfoundation/keystore-core'
import { secp256k1Binding } from './binding'
import { SECP256K1_ALGORITHM, withSubtleSecp256k1 } from './shim'

export { SECP256K1_ALGORITHM, withSubtleSecp256k1 } from './shim'
export type { Secp256k1Binding } from './binding'

export const secp256k1Shim = (): SubtleShim =>
    tagShim(SECP256K1_ALGORITHM, host =>
        withSubtleSecp256k1(host, secp256k1Binding),
    )
