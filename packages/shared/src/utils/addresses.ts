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

const MAX_ADDRESS_DISPLAY = 11

/**
 * Truncates an Algorand address for display by showing a prefix and suffix with ellipses in between.
 *
 * @param address - Full Algorand address
 * @param maxLength - Maximum number of characters to show (including ellipses)
 * @returns Truncated address (e.g., "ALGO...XYZ")
 *
 * @example
 * truncateAlgorandAddress('ALGORAND123...XYZ789', 11) // Returns 'ALGO...Z789'
 */
export const truncateAlgorandAddress = (
    address: string,
    maxLength: number = MAX_ADDRESS_DISPLAY,
) => {
    const prefixLength =
        maxLength % 2 === 0 ? maxLength / 2 : (maxLength - 1) / 2
    if (address.length <= maxLength) return address
    return `${address.substring(0, prefixLength)}...${address.substring(address.length - prefixLength)}`
}
