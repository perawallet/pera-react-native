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

import {
    isHardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

type SplitLocalUnsignedSignersResult = {
    /** Local-key participants (Algo25, HD) — eligible for batch dispatch. */
    localKey: WalletAccount[]
    /** Hardware-wallet (Ledger) participant addresses — sign one device prompt at a time via the per-row Sign button. */
    hardware: Set<string>
}

/**
 * Splits the result of `getLocalUnsignedSigners` by signing custody so the
 * footer Sign button can batch-dispatch local-key signers while hardware
 * participants are dispatched per-row. Address order within `localKey` is
 * preserved from the input.
 */
export const splitLocalUnsignedSigners = (
    localUnsignedSigners: WalletAccount[],
): SplitLocalUnsignedSignersResult => {
    const localKey: WalletAccount[] = []
    const hardware = new Set<string>()
    for (const account of localUnsignedSigners) {
        if (isHardwareWalletAccount(account)) {
            hardware.add(account.address)
        } else {
            localKey.push(account)
        }
    }
    return { localKey, hardware }
}
