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

// Not imported from apps/mobile's i18n registry: packages/* must not depend
// on apps/mobile. 'en' is just this package's own pre-i18n-init default.
const DEFAULT_LOCALE = 'en'

let activeLocale: string = DEFAULT_LOCALE

/**
 * The app's current UI language as an Intl-compatible tag ('en', 'de',
 * 'pt-BR'). Owned here so `formatNumber`/`formatCurrency`/`formatDatetime`
 * can default to it without every call site threading a locale through —
 * the app sets it once, from i18next's `languageChanged` event.
 */
export const getActiveLocale = (): string => activeLocale

/** Only the app's i18n init/listener should call this — see {@link getActiveLocale}. */
export const setActiveLocale = (locale: string): void => {
    activeLocale = locale
}
