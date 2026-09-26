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

import { verifyAddress } from '@perawallet/wallet-core-hardware-wallet'
import type {
    LedgerAccount,
    LedgerTransport,
} from '@perawallet/wallet-extension-ledger-shared'
import { classifyLedgerError } from '@perawallet/wallet-extension-ledger-shared'

/**
 * Verify a Ledger account address on the device.
 *
 * Sends the address to the Ledger device with the verify flag set (P1=0x80),
 * which displays the address on the device screen for the user to visually confirm.
 * The user must approve on the device before this resolves.
 *
 * @param transport - Connected Ledger transport
 * @param accountIndex - The account index to verify
 * @returns The verified account (address matches what was shown on device)
 * @throws LedgerUserRejectedError if the user rejects on the device
 */
export const verifyLedgerAddress = async (
    transport: LedgerTransport,
    accountIndex: number,
): Promise<LedgerAccount> => {
    return verifyAddress(transport, accountIndex, classifyLedgerError)
}
