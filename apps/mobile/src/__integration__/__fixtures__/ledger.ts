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

import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { LedgerAppDriverNotRegisteredError } from '@perawallet/wallet-extension-hardware-wallet'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type FakeLedgerOptions = {
    address: string | ((accountIndex: number, chainId: ChainId) => string)
    /** The chains whose device app the fake serves; the legacy chain alone by default. */
    chainIds?: readonly ChainId[]
    // Resolves immediately by default. Pass one that blocks on a deferred to
    // observe the awaiting-approval UI before releasing the signature.
    signTransaction?: (
        accountIndex: number,
        payload: Uint8Array,
    ) => Promise<Uint8Array>
}

// Without a registered BLE transport every Ledger screen throws
// `LedgerProviderNotFoundError` before reaching the flow under test. A chain
// outside `chainIds` fails to connect the way a device without its app does.
export const registerFakeLedgerProvider = ({
    address,
    chainIds = [LEGACY_CHAIN_ID],
    signTransaction = async () => new Uint8Array(64),
}: FakeLedgerOptions): void => {
    getProvider().hardwareWalletRegistry.register({
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: () => () => {},
        connect: async (_deviceId: string, chainId: string) => {
            if (!chainIds.includes(chainId as ChainId)) {
                throw new LedgerAppDriverNotRegisteredError(chainId)
            }
            return {
                getAddress: async (accountIndex: number) => ({
                    address:
                        typeof address === 'function'
                            ? address(accountIndex, chainId as ChainId)
                            : address,
                    // An Ed25519 key on the legacy chain, an uncompressed secp256k1 one elsewhere.
                    publicKey: new Uint8Array(
                        chainId === LEGACY_CHAIN_ID ? 32 : 65,
                    ),
                    accountIndex,
                }),
                signTransaction,
                signMessage: async () => new Uint8Array(64),
                getAppVersion: async () => ({ major: 0, minor: 0, patch: 0 }),
                disconnect: async () => {},
            }
        },
        isSupported: async () => false,
    })
}
