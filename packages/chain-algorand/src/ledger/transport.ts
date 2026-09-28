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
    LedgerAppErrorClassifier,
    LedgerAppTransport,
} from '@perawallet/wallet-extension-hardware-wallet'
import {
    classifyLedgerError,
    LedgerSigningError,
} from '@perawallet/wallet-extension-ledger-shared'
import { buildLedgerAccountPath } from './path'

/**
 * Wraps a connected Ledger transport + Algorand app instance into the
 * platform-agnostic HardwareWalletTransport interface. The APDU layer is
 * transport-independent, so every transport package (native BLE/USB, web
 * BLE/USB) reaches this through the Algorand Ledger app driver.
 *
 * `classifyError` lets a transport map its own error shapes, which APDU
 * exchanges surface as well as `connect`.
 */
export const createAlgorandLedgerTransport = (
    transport: LedgerAppTransport,
    algorandApp: AlgorandApp,
    classifyError: LedgerAppErrorClassifier = classifyLedgerError,
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
            throw classifyError(error)
        }
    },

    async signTransaction(accountIndex, txnBytes) {
        try {
            // Re-prime the device onto this account index before EVERY sign,
            // never cached. The Algorand app only re-derives its signing path
            // from an APDU carrying P1_FIRST_ACCOUNT_ID, which
            // `AlgorandApp.sign` omits for account 0 — so without this the
            // device keeps signing with whatever account a prior call (possibly
            // another host's) left it on. `getAddressAndPubKey` always sends the
            // prefix, so it reliably re-asserts.
            //
            // Not cached because a cache reflects only our own calls, not the
            // device state, which can move outside our visibility.
            await algorandApp.getAddressAndPubKey(accountIndex, false)

            // AlgorandApp.sign decodes a string message as UTF-8, so the
            // msgpack bytes MUST be passed as a Buffer. The library strips the
            // trailing status word, so the returned signature is already clean.
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
            throw classifyError(error)
        }
    },

    async getAppVersion() {
        try {
            const { major, minor, patch } = await algorandApp.getVersion()
            return { major, minor, patch }
        } catch (error) {
            throw classifyError(error)
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
            throw classifyError(error)
        }
    },

    ...(transport.on
        ? {
              onDisconnect: (listener: () => void) => {
                  transport.on?.('disconnect', listener)
                  return () => transport.off?.('disconnect', listener)
              },
          }
        : {}),

    async disconnect() {
        await transport.close()
    },
})
