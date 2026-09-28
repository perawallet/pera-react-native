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

import { getProvider } from '@perawallet/wallet-extension-provider'

export type FakeLedgerOptions = {
    address: string | ((accountIndex: number) => string)
    // Resolves immediately by default. Pass one that blocks on a deferred to
    // observe the awaiting-approval UI before releasing the signature.
    signTransaction?: () => Promise<Uint8Array>
}

// Without a registered BLE transport every Ledger screen throws
// `LedgerProviderNotFoundError` before reaching the flow under test.
export const registerFakeLedgerProvider = ({
    address,
    signTransaction = async () => new Uint8Array(64),
}: FakeLedgerOptions): void => {
    getProvider().hardwareWalletRegistry.register({
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: () => () => {},
        connect: async () => ({
            getAddress: async (accountIndex: number) => ({
                address:
                    typeof address === 'function'
                        ? address(accountIndex)
                        : address,
                publicKey: new Uint8Array(32),
                accountIndex,
            }),
            signTransaction,
            signData: async () => new Uint8Array(64),
            getAppVersion: async () => ({ major: 0, minor: 0, patch: 0 }),
            disconnect: async () => {},
        }),
        isSupported: async () => false,
    })
}
