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
import { RNLedgerUsbService } from './RNLedgerUsbService'

/**
 * wallet-provider Extension that registers the Ledger USB hardware wallet
 * transport provider into the hardware wallet registry.
 *
 * Compose AFTER the platform extension (which provides
 * `hardwareWalletRegistry`) and AFTER `WithLedgerExtension` so the BLE
 * provider lands first by convention. iOS still registers this provider —
 * its `isSupported()` returns false on iOS, so consumers naturally skip it.
 */
export const WithLedgerUsbExtension = (provider: {
    hardwareWalletRegistry: HardwareWalletRegistry
}) => {
    const ledgerUsbService = new RNLedgerUsbService()
    provider.hardwareWalletRegistry.register(
        ledgerUsbService.createTransportProvider(),
    )
    return {}
}
