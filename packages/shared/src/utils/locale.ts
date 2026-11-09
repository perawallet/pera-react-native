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

const listeners = new Set<() => void>()

/** Only the app's i18n init/listener should call this — see {@link getActiveLocale}. */
export const setActiveLocale = (locale: string): void => {
    if (locale === activeLocale) return
    activeLocale = locale
    listeners.forEach(listener => listener())
}

/**
 * `Accept-Language` for a locale tag. English trails as a graded fallback so a
 * backend with no translation answers in English rather than its own default;
 * a regional tag offers its base language in between (`pt-BR` → `pt`).
 */
export const buildAcceptLanguage = (locale: string): string => {
    if (locale === DEFAULT_LOCALE) return DEFAULT_LOCALE

    const baseLanguage = locale.split('-')[0] ?? locale
    const parts = [locale]
    if (baseLanguage !== locale) parts.push(`${baseLanguage};q=0.9`)
    if (baseLanguage !== DEFAULT_LOCALE) parts.push(`${DEFAULT_LOCALE};q=0.8`)
    return parts.join(',')
}

/** Notifies `listener` after each change; returns the unsubscribe. */
export const subscribeActiveLocale = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
