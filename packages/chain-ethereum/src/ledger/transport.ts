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
import { bytesToHex, hexToBytes } from 'viem'
import { logger, withTimeout } from '@perawallet/wallet-core-shared'
import type {
    HardwareWalletTransport,
    LedgerAppErrorClassifier,
    LedgerAppTransport,
} from '@perawallet/wallet-extension-hardware-wallet'
import {
    classifyLedgerAppError,
    classifyLedgerError,
    LedgerBlindSigningRequiredError,
    LedgerOperationUnsupportedError,
    LedgerSigningError,
} from '@perawallet/wallet-extension-ledger-shared'
import { normalizeEvmAddress } from '../accounts/address-codec'
import { ethereumHdPath } from '../accounts/hd-derivation'
import { ETHEREUM_LEDGER_APP } from './app'

type SignResolution = Parameters<Eth['signTransaction']>[2]

// Token metadata only: plugins, NFTs and Uniswap would each add a lookup to
// Ledger's services that a plain transfer does not need.
const ERC20_ONLY_RESOLUTION = {
    erc20: true,
    externalPlugins: false,
    nft: false,
    uniswapV3: false,
}

// A hung descriptor service must not hold the sign until the 5-minute ceiling.
const RESOLUTION_TIMEOUT_MS = 10_000

const COMPONENT_HEX_LENGTH = 64

// hw-app-eth returns typed transactions' `v` as the y-parity ("00" or "01");
// anything else would encode a signature the planner's `assemble` misreads.
const toEthereumSignatureBytes = ({
    v,
    r,
    s,
}: {
    v: string
    r: string
    s: string
}): Uint8Array => {
    if (
        !/^0?[01]$/.test(v) ||
        r.length !== COMPONENT_HEX_LENGTH ||
        s.length !== COMPONENT_HEX_LENGTH
    ) {
        throw new LedgerSigningError('Unexpected signature returned')
    }
    return hexToBytes(`0x${r}${s}0${v.slice(-1)}`)
}

export const createEthereumLedgerTransport = (
    transport: LedgerAppTransport,
    eth: Eth,
    classifyTransportError: LedgerAppErrorClassifier = classifyLedgerError,
): HardwareWalletTransport => {
    const classifyError = (error: unknown) =>
        // `Eth.signTransaction` remaps 0x6a80 into this error, which carries no
        // status word for the profile to match. Matched by name rather than
        // `instanceof`, for the reason on `LIB_ERROR_FACTORY_BY_NAME`.
        error instanceof Error &&
        error.name === 'EthAppPleaseEnableContractData'
            ? new LedgerBlindSigningRequiredError({
                  appName: ETHEREUM_LEDGER_APP.appName,
                  originalError: error,
              })
            : classifyLedgerAppError(
                  error,
                  ETHEREUM_LEDGER_APP,
                  classifyTransportError,
              )

    const unsupported = () =>
        Promise.reject(
            new LedgerOperationUnsupportedError({
                appName: ETHEREUM_LEDGER_APP.appName,
                operation: 'signData',
            }),
        )

    return {
        async getAddress(accountIndex, verify = false) {
            try {
                const result = await eth.getAddress(
                    ethereumHdPath(accountIndex, 0),
                    verify,
                )
                return {
                    address: normalizeEvmAddress(result.address),
                    publicKey: hexToBytes(`0x${result.publicKey}`),
                    accountIndex,
                }
            } catch (error) {
                throw classifyError(error)
            }
        },

        async signTransaction(accountIndex, payload) {
            try {
                // hw-app-eth does `Buffer.from(hex, 'hex')`, which reads a `0x`
                // prefix as an empty buffer.
                const rawTxHex = bytesToHex(payload).slice(2)

                let resolution: SignResolution = null
                try {
                    resolution = await withTimeout(
                        eth.ledgerService.resolveTransaction(
                            rawTxHex,
                            eth.loadConfig,
                            ERC20_ONLY_RESOLUTION,
                        ),
                        RESOLUTION_TIMEOUT_MS,
                        'Resolve Ledger clear-signing descriptors',
                    )
                } catch (error) {
                    // Null signs blind and lets the device decide, so a failed
                    // lookup only costs the on-screen detail. Never log the
                    // transaction itself.
                    logger.warn(
                        'ethereum ledger: clear-signing resolution failed, signing without descriptors',
                        { error },
                    )
                }

                return toEthereumSignatureBytes(
                    await eth.signTransaction(
                        ethereumHdPath(accountIndex, 0),
                        rawTxHex,
                        resolution,
                    ),
                )
            } catch (error) {
                throw classifyError(error)
            }
        },

        async getAppVersion() {
            try {
                const { version } = await eth.getAppConfiguration()
                const [major, minor, patch] = version.split('.').map(Number)
                return { major, minor, patch }
            } catch (error) {
                throw classifyError(error)
            }
        },

        assertCanSignData: unsupported,

        signData: unsupported,

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
    }
}
