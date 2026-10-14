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

/**
 * Total characters retained by {@link truncateAlgorandAddress}, split evenly
 * between prefix and suffix: 11 renders as `5…5`, 20 renders as `10…10`.
 * Canonical source of truth — import these instead of re-declaring the length.
 */
export const SHORT_ADDRESS_LENGTH = 11
export const LONG_ADDRESS_LENGTH = 20

export const truncateAlgorandAddress = (
    address: string,
    maxLength: number = SHORT_ADDRESS_LENGTH,
) => {
    const prefixLength =
        maxLength % 2 === 0 ? maxLength / 2 : (maxLength - 1) / 2
    if (address.length <= maxLength) return address
    return `${address.substring(0, prefixLength)}...${address.substring(address.length - prefixLength)}`
}
