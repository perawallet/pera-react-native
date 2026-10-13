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

import { describe, test, expect, vi, type Mock } from 'vitest'
import { createWalletAlgorandClient } from '../createWalletAlgorandClient'
import { createTimeoutBoundedAlgorandClient } from '../createAlgorandClient'

vi.mock('../createAlgorandClient', () => ({
    createTimeoutBoundedAlgorandClient: vi.fn(() => ({
        setDefaultSigner: vi.fn(),
        setDefaultValidityWindow: vi.fn(),
    })),
}))

describe('createWalletAlgorandClient', () => {
    test("builds against the network's endpoints with the hardware-wallet validity window", () => {
        const client = createWalletAlgorandClient('testnet')

        expect(createTimeoutBoundedAlgorandClient).toHaveBeenCalledWith(
            expect.objectContaining({
                algodUrl: expect.stringContaining('testnet'),
            }),
        )
        expect(client.setDefaultValidityWindow).toHaveBeenCalledWith(1000)
    })

    test('routes signing to the pipeline when no signer is given', async () => {
        const client = createWalletAlgorandClient('mainnet')

        const signer = (client.setDefaultSigner as Mock).mock.calls[0][0]
        await expect(signer()).rejects.toThrow(/should not be invoked/)
    })
})
