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

import { describe, it, expect } from 'vitest'
import type { LegacyMigrationData } from '@perawallet/wallet-extension-platform'
import { scrubLegacyPayloadSecrets } from '../scrubLegacyPayload'

const buildData = (
    overrides: Partial<LegacyMigrationData> = {},
): LegacyMigrationData =>
    ({
        auth: { pin: new Uint8Array(6).fill(7) },
        accounts: [
            { address: 'A', secretKey: new Uint8Array(32).fill(1) },
            { address: 'B', secretKey: null },
        ],
        hdWallets: [
            {
                walletId: 'w1',
                entropy: new Uint8Array(32).fill(2),
                keys: [
                    { address: 'K1', privateKey: new Uint8Array(32).fill(3) },
                    { address: 'K2', privateKey: null },
                ],
            },
        ],
        ...overrides,
    }) as unknown as LegacyMigrationData

describe('scrubLegacyPayloadSecrets', () => {
    it('zeroes the auth pin, account secret keys, wallet entropy, and HD private keys', () => {
        const data = buildData()

        scrubLegacyPayloadSecrets(data)

        expect(data.auth.pin?.every(b => b === 0)).toBe(true)
        expect(data.accounts[0].secretKey?.every(b => b === 0)).toBe(true)
        expect(data.hdWallets[0].entropy?.every(b => b === 0)).toBe(true)
        expect(data.hdWallets[0].keys[0].privateKey?.every(b => b === 0)).toBe(
            true,
        )
    })

    it('tolerates null secret fields without throwing', () => {
        const data = buildData({
            auth: { pin: null },
            accounts: [{ address: 'B', secretKey: null } as never],
            hdWallets: [{ walletId: 'w', entropy: null, keys: [] } as never],
        })

        expect(() => scrubLegacyPayloadSecrets(data)).not.toThrow()
    })
})
