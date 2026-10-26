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
 * The chains a scale actually covers: Algorand first, then the build's other
 * chains, up to the scale's count. A build that enables fewer chains than the
 * scale asks for runs with fewer, so M on a two-chain build covers two chains.
 */
export const chainsForScale = (
    scaleChains: number,
    enabledChains: readonly string[],
): string[] => {
    const others = enabledChains.filter(chainId => chainId !== 'algorand')
    return ['algorand', ...others].slice(0, Math.max(1, scaleChains))
}
