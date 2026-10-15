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

/** An i18n key a `t()` call can render. */
export type I18nKey = string & { readonly __i18nKey: unique symbol }

/**
 * The only way to make an `I18nKey`. Identity at run time; the argument must
 * be a string literal naming the whole key, which `pera/i18n-key-exists`
 * checks against `en.json`.
 */
export const i18nKey = (key: string): I18nKey => key as I18nKey
