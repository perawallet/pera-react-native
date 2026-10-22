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
    hexToBytes,
    isAddressEqual,
    keccak256,
    recoverAddress,
} from 'viem'
import { logger, withTimeout } from '@perawallet/wallet-core-shared'
import { InvalidSignableDataError } from '@perawallet/wallet-core-signing'
import type {
    HardwareWalletTransport,
    LedgerAppErrorClassifier,
    LedgerAppTransport,
} from '@perawallet/wallet-extension-hardware-wallet'
import {
    classifyLedgerAppError,
    classifyLedgerError,
    getStatusCode,
    LedgerBlindSigningRequiredError,
    LedgerSigningError,
} from '@perawallet/wallet-extension-ledger-shared'
import { normalizeEvmAddress } from '../accounts/address-codec'
import { ethereumHdPath } from '../accounts/hd-derivation'
import { ETHEREUM_LEDGER_APP } from './app'
import {
    decodeEthereumLedgerMessage,
    type EthereumLedgerMessage,
} from './messagePayload'

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

// INS not supported: a Nano S, or an app too old for full EIP-712.
const EIP712_UNSUPPORTED_STATUS = 0x6d_00

const MESSAGE_V = new Set([27, 28])

// hw-app-eth returns a message's `v` as 27/28; `assemble` reads the recovery bit.
const toMessageSignatureBytes = ({
    v,
    r,
    s,
}: {
    v: number
    r: string
    s: string
}): Uint8Array => {
    if (
        !MESSAGE_V.has(v) ||
        r.length !== COMPONENT_HEX_LENGTH ||
        s.length !== COMPONENT_HEX_LENGTH
    ) {
        throw new LedgerSigningError('Unexpected signature returned')
    }
    return hexToBytes(`0x${r}${s}0${v - 27}`)
}

// A host bug, not a device failure, so no retry can fix it.
const decodeMessage = (payload: Uint8Array): EthereumLedgerMessage => {
    try {
        return decodeEthereumLedgerMessage(payload)
    } catch {
        throw new InvalidSignableDataError('Not an Ethereum Ledger message')
    }
}

// The app hashes the message itself, so an encoding it disagrees on would
// otherwise reach the dApp as a valid signature for some other address.
const assertSignsPlannedDigest = async (
    message: EthereumLedgerMessage,
    signature: Uint8Array,
): Promise<void> => {
    const hash =
        message.kind === 'personal'
            ? hashMessage({ raw: message.message })
            : keccak256(
                  concat([
                      '0x1901',
                      message.domainSeparator,
                      message.structHash,
                  ]),
              )
    const recovered = await recoverAddress({
        hash,
        signature: bytesToHex(signature),
    })
    if (!isAddressEqual(recovered, message.signer)) {
        throw new LedgerSigningError(
            'The device signed something other than the reviewed message',
        )
    }
}

// hw-app-eth does `Buffer.from(hex, 'hex')`, which reads a `0x` prefix as an empty buffer.
const unprefixed = (hex: string): string => hex.slice(2)

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

        async signMessage(accountIndex, payload) {
            try {
                const message = decodeMessage(payload)
                const path = ethereumHdPath(accountIndex, 0)
                if (message.kind === 'personal') {
                    const signature = toMessageSignatureBytes(
                        await eth.signPersonalMessage(
                            path,
                            unprefixed(message.message),
                        ),
                    )
                    await assertSignsPlannedDigest(message, signature)
                    return signature
                }
                // Full mode fetches Ledger's clear-signing filters with no
                // timeout of its own; the leg's confirmation ceiling bounds it.
                const signature = await eth
                    .signEIP712Message(path, message.typedData as never)
                    .catch((error: unknown) => {
                        if (
                            getStatusCode(error) !== EIP712_UNSUPPORTED_STATUS
                        ) {
                            throw error
                        }
                        return eth.signEIP712HashedMessage(
                            path,
                            unprefixed(message.domainSeparator),
                            unprefixed(message.structHash),
                        )
                    })
                const bytes = toMessageSignatureBytes(signature)
                await assertSignsPlannedDigest(message, bytes)
                return bytes
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
    }
}
