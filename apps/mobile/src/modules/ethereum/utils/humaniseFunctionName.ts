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
 * A contract function name as a title: `claimAllRewardsToSelf` reads
 * "Claim all rewards to self". A name is contract data, so it is never
 * translated.
 */
export const humaniseFunctionName = (name: string): string => {
    const words = name
        .replace(/_+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    if (words.length === 0) return name
    const [first, ...rest] = words.map(word =>
        word.length > 1 && word === word.toUpperCase()
            ? word
            : word.toLowerCase(),
    )
    return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ')
}
