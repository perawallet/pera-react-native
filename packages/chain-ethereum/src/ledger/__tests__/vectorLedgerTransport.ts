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

import { keccak256 } from 'viem'
import type { HardwareWalletTransport } from '@perawallet/wallet-extension-hardware-wallet'
import { SENDER, vectorSignature } from '../../signing/__tests__/fixtures'

/**
 * A Ledger running the Ethereum app, answering from the known-answer vectors:
 * it hashes the unsigned serialization it is handed, as the app does, and
 * returns the vector key's `r‖s‖recovery` signature over that hash.
 */
export const createVectorLedgerTransport = (
    options: { address?: string } = {},
): { transport: HardwareWalletTransport; signedPayloads: Uint8Array[] } => {
    const signedPayloads: Uint8Array[] = []
    const transport: HardwareWalletTransport = {
        getAddress: async accountIndex => ({
            address: options.address ?? SENDER,
            publicKey: new Uint8Array(65),
            accountIndex,
        }),
        signTransaction: async (_accountIndex, payload) => {
            signedPayloads.push(payload)
            return vectorSignature(keccak256(payload, 'bytes'))
        },
        signData: async () => {
            throw new Error('The Ethereum app signs no auth data')
        },
        getAppVersion: async () => ({ major: 1, minor: 0, patch: 0 }),
        assertCanSignData: async () => undefined,
        disconnect: async () => undefined,
    }
    return { transport, signedPayloads }
}
