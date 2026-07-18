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

import { Buffer } from 'buffer'
import type { AlgorandApp } from '@algorandfoundation/ledger-algorand-js'
import type {
    HardwareWalletArbitrarySignRequest,
    HardwareWalletTransport,
} from '@perawallet/wallet-core-hardware-wallet'
import { buildLedgerAccountPath } from './constants'
import { classifyLedgerError, LedgerSigningError } from './errors'

/**
 * Minimal transport shape this wrapper needs — deliberately NOT
 * `@ledgerhq/hw-transport`'s `Transport` class, so this file (loaded via the
 * `/protocol` subpath by `@perawallet/wallet-core-ledger` and by the web
 * transport packages) never pulls in any concrete transport module.
 */
export type LedgerAppTransport = {
    close: () => Promise<void>
}

/**
 * Wraps a connected Ledger transport + Algorand app instance into the
 * platform-agnostic HardwareWalletTransport interface. The APDU layer is
 * transport-independent — this is shared by every transport package
 * (native BLE/USB, web BLE/USB) instead of being duplicated per package.
 */
export const createLedgerTransportWrapper = (
    transport: LedgerAppTransport,
    algorandApp: AlgorandApp,
): HardwareWalletTransport => ({
    async getAddress(accountIndex, verify = false) {
        try {
            const result = await algorandApp.getAddressAndPubKey(
                accountIndex,
                verify,
            )
            return {
                address: result.address.toString(),
                publicKey: Uint8Array.from(result.publicKey),
                accountIndex,
            }
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async signTransaction(accountIndex, txnBytes) {
        try {
            const result = await algorandApp.sign(
                accountIndex,
                Buffer.from(txnBytes),
            )
            const signature = Uint8Array.from(result.signature)
            if (signature.length === 0) {
                throw new LedgerSigningError('Empty signature returned')
            }
            return signature
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async getAppVersion() {
        try {
            const { major, minor, patch } = await algorandApp.getVersion()
            return { major, minor, patch }
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async signData(
        request: HardwareWalletArbitrarySignRequest,
    ): Promise<Uint8Array> {
        try {
            const result = await algorandApp.signData(
                {
                    data: request.data,
                    signer: request.signerPublicKey,
                    domain: request.domain,
                    authenticationData: request.authenticatorData,
                    requestId: request.requestId,
                    hdPath: buildLedgerAccountPath(request.accountIndex),
                },
                { scope: request.scope, encoding: request.encoding },
            )
            const signature = Uint8Array.from(result.signature)
            if (signature.length === 0) {
                throw new LedgerSigningError('Empty signature returned')
            }
            return signature
        } catch (error) {
            throw classifyLedgerError(error)
        }
    },

    async disconnect() {
        await transport.close()
    },
})
