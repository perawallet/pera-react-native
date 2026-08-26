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
 * Strips only what an IME actually adds — case, whitespace, punctuation,
 * symbols, and invisible format characters (zero-width space/joiner, bidi
 * marks) some IMEs inject silently. Anything else (digits, other letters) is
 * left in place so a genuinely wrong token still fails wordlist validation
 * and gets flagged, instead of being silently rewritten into a different
 * real word.
 */
export const normalizeMnemonicWord = (value: string): string =>
    value.toLowerCase().replace(/[\s\p{P}\p{S}\p{Cf}]/gu, '')
