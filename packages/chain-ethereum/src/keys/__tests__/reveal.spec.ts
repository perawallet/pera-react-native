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

import { describe, expect, test, vi } from 'vitest'
import { revealEthereumPrivateKey } from '../reveal'

describe('revealEthereumPrivateKey', () => {
    test('reads the key back through the keystore under the given domain', async () => {
        const key = Uint8Array.from([1, 2, 3])
        const exportSecp256k1Key = vi.fn().mockResolvedValue(key)

        const revealed = await revealEthereumPrivateKey(
            { exportSecp256k1Key },
            'key-id',
            'backup',
        )

        expect(revealed).toBe(key)
        expect(exportSecp256k1Key).toHaveBeenCalledWith('key-id', 'backup')
    })
})
