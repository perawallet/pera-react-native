/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useMemo } from 'react'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useLedgerConnection as useLedgerConnectionCore } from '@perawallet/wallet-core-ledger'

/**
 * App-level wrapper around the core useLedgerConnection hook
 * that resolves the Ledger transport provider from the app's
 * hardware wallet registry.
 */
export const useLedgerConnection = () => {
    const provider = useMemo(
        () => getProvider().hardwareWalletRegistry.getProvider('ledger')!,
        [],
    )
    return useLedgerConnectionCore(provider)
}
