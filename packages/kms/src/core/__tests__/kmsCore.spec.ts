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

// @vitest-environment node
import { describe, expect, test, vi } from 'vitest'
import { SIGNING_ACCESS_DOMAIN } from '../../constants'

const { mockGetProvider } = vi.hoisted(() => ({ mockGetProvider: vi.fn() }))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => mockGetProvider(),
    getKeystoreStore: () => ({
        state: {
            keys: [
                {
                    id: 'seed-1',
                    type: 'hd-root-key',
                    algorithm: 'raw',
                    extractable: true,
                    metadata: { scheme: 'bip39' },
                },
                {
                    id: 'c-1',
                    type: 'hd-derived-ed25519',
                    algorithm: 'EdDSA',
                    extractable: false,
                    metadata: { parentKeyId: 'seed-1' },
                },
            ],
        },
    }),
}))

import { kmsCore } from '../kmsCore'

describe('kmsCore', () => {
    test('reads the provider keystore at call time, not at import', async () => {
        expect(mockGetProvider).not.toHaveBeenCalled()

        const sign = vi.fn(async () => new Uint8Array([9]))
        mockGetProvider.mockReturnValue({ key: { store: { sign } } })
        const payload = new Uint8Array([1])

        await expect(
            kmsCore.sign('c-1', payload, SIGNING_ACCESS_DOMAIN),
        ).resolves.toEqual(new Uint8Array([9]))
        expect(sign).toHaveBeenCalledWith('c-1', payload)
    })
})
