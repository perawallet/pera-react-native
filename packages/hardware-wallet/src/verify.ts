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

import type {
    HardwareWalletDerivedAccount,
    HardwareWalletTransport,
} from './types'

/**
 * Verify a hardware wallet account address on the device.
 *
 * Sends the address to the device with the verify flag set,
 * which displays the address on the device screen for the user to visually confirm.
 * The user must approve on the device before this resolves.
 *
 * @param transport - Connected hardware wallet transport
 * @param accountIndex - The account index to verify
 * @param classifyError - Optional error classifier for manufacturer-specific errors
 * @returns The verified account (address matches what was shown on device)
 */
export const verifyAddress = async (
    transport: HardwareWalletTransport,
    accountIndex: number,
    classifyError?: (error: unknown) => Error,
): Promise<HardwareWalletDerivedAccount> => {
    try {
        return await transport.getAddress(accountIndex, true)
    } catch (error) {
        throw classifyError ? classifyError(error) : error
    }
}
