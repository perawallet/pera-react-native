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

import type Eth from '@ledgerhq/hw-app-eth'
import {
    bytesToHex,
    concat,
    hashMessage,
    hashTypedData,
    hexToBytes,
    keccak256,
} from 'viem'
import type { Hex, TypedDataDefinition } from 'viem'
import type { HardwareWalletTransport } from '@perawallet/wallet-extension-hardware-wallet'
import { SENDER, vectorSignature } from '../../signing/__tests__/fixtures'
import { createEthereumLedgerTransport } from '../transport'

// Hardhat #0's uncompressed public key, as the app returns it (no `0x`).
const HARDHAT_PUBLIC_KEY =
    '048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5'

// The app hashes what it is handed and answers `v` as 27/28 for a message.
const appSignature = (digest: Hex) => {
    const hex = bytesToHex(vectorSignature(hexToBytes(digest))).slice(2)
    return {
        r: hex.slice(0, 64),
        s: hex.slice(64, 128),
        v: 27 + Number.parseInt(hex.slice(128), 16),
    }
}

/**
 * The real Ethereum Ledger transport over a fake app that signs messages with
 * the known-answer vector key. `fullEip712: false` answers full EIP-712 as a
 * Nano S does, so the driver has to fall back to hashed mode.
 */
export const createVectorEthereumLedger = (
    options: { fullEip712?: boolean } = {},
): { transport: HardwareWalletTransport; app: Record<string, unknown> } => {
    const app = {
        getAddress: async () => ({
            address: SENDER.toLowerCase(),
            publicKey: HARDHAT_PUBLIC_KEY,
        }),
        signPersonalMessage: async (_path: string, messageHex: string) =>
            appSignature(hashMessage({ raw: `0x${messageHex}` })),
        signEIP712Message: async (
            _path: string,
            typedData: TypedDataDefinition,
        ) => {
            if (options.fullEip712 === false) {
                throw Object.assign(new Error('INS not supported'), {
                    statusCode: 0x6d00,
                })
            }
            return appSignature(hashTypedData(typedData))
        },
        signEIP712HashedMessage: async (
            _path: string,
            domainSeparator: string,
            structHash: string,
        ) =>
            appSignature(
                keccak256(
                    concat([
                        '0x1901',
                        `0x${domainSeparator}`,
                        `0x${structHash}`,
                    ]),
                ),
            ),
        getAppConfiguration: async () => ({ version: '1.13.0' }),
    }
    const transport = createEthereumLedgerTransport(
        { close: async () => undefined },
        app as unknown as Eth,
    )
    return { transport, app }
}
