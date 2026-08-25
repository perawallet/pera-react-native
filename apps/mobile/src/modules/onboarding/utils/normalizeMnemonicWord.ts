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
 * Folds a typed mnemonic token to the exact form the wordlists use.
 *
 * `seedFromMnemonic` matches the wordlist byte-exactly, and Android IMEs
 * (Samsung Keyboard, Gboard) can capitalize or append punctuation even with
 * `autoCapitalize='none'` — so a passphrase that is genuinely correct arrives
 * unusable. Both wordlists are pure lowercase a-z, which makes dropping every
 * other character safe rather than lossy.
 */
export const normalizeMnemonicWord = (value: string): string =>
    value.toLowerCase().replace(/[^a-z]/g, '')
