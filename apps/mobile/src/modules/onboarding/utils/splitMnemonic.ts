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

/**
 * Split a pasted mnemonic blob into individual words. Accepts any mix of
 * whitespace and commas as separators so users can paste `a b c`, `a,b,c`,
 * or `a, b, c` regardless of how their source app formatted the list.
 */
export const splitMnemonic = (value: string): string[] =>
    value
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
