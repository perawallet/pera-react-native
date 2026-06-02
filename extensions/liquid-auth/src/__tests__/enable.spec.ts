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

import { describe, it, expect } from 'vitest'
import { createEnableHandler } from '../handlers/enable'

const ctx = {
    providerId: 'pera',
    genesisHash: 'gh',
    genesisId: 'mainnet-v1.0',
}

describe('enable handler', () => {
    it('echoes the FIDO-bound accounts approved at connect time', async () => {
        const handler = createEnableHandler({
            ...ctx,
            accounts: ['ADDR1'],
        })
        const result = await handler({
            id: 'r',
            reference: 'arc0027:enable:request',
            params: { providerId: 'pera' },
        })
        expect(result).toMatchObject({
            providerId: 'pera',
            genesisHash: 'gh',
            genesisId: 'mainnet-v1.0',
            accounts: [{ address: 'ADDR1' }],
        })
    })
})
