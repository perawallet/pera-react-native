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

import type { TranslateFn } from './resolveErrorCopy'

/**
 * Screen titles are usually i18n keys, but some are already-translated text
 * or user data (a device name), which must not be looked up as a key.
 */
export const translateIfKey = (t: TranslateFn, title: string): string =>
    title.includes('.') && !title.includes(' ') ? t(title) : title
