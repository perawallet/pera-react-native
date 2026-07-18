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

import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { LedgerWebBleService } from './LedgerWebBleService'

/**
 * wallet-provider Extension that registers the Web Bluetooth Ledger hardware
 * wallet transport provider into the hardware wallet registry. Web
 * counterpart to @perawallet/wallet-extension-ledger-react-native's
 * WithLedgerExtension.
 *
 * Must be composed AFTER the platform extension, which provides the
 * `hardwareWalletRegistry` on the provider instance.
 */
export const WithLedgerWebBleExtension = (provider: {
    hardwareWalletRegistry: HardwareWalletRegistry
}) => {
    const service = new LedgerWebBleService()
    provider.hardwareWalletRegistry.register(service.createTransportProvider())
    return {}
}
