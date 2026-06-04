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

import { mnemonicFromSeed } from '@algorandfoundation/algokit-utils/algo25'
import { ALGO25_SEED_LENGTH } from '../constants'

export const algo25SecretKeyToMnemonic = (secretKey: Uint8Array): string => {
    const seed =
        secretKey.length >= ALGO25_SEED_LENGTH
            ? secretKey.slice(0, ALGO25_SEED_LENGTH)
            : secretKey
    try {
        return mnemonicFromSeed(seed)
    } finally {
        seed.fill(0)
    }
}
