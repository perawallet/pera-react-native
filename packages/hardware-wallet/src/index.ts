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

// The device and registry contract lives in the hardware-wallet provider
// extension so transports implement it without depending on this package;
// re-exported for callers here.
export {
    createHardwareWalletRegistry,
    type HardwareWalletAdapterState,
    type HardwareWalletAppVersion,
    type HardwareWalletArbitrarySignRequest,
    type HardwareWalletConnectionStatus,
    type HardwareWalletDerivedAccount,
    type HardwareWalletDevice,
    type HardwareWalletManufacturer,
    type HardwareWalletRegistry,
    type HardwareWalletTransport,
    type HardwareWalletTransportProvider,
    type LedgerTransportType,
} from '@perawallet/wallet-extension-hardware-wallet'
export * from './constants'
export { discoverAccounts, type DiscoverAccountsOptions } from './discovery'
export { verifyAddress } from './verify'
