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

const LOCALE_LABELS: Readonly<Record<string, string>> = {
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
}

/**
 * Language names are shown in their own language, not translated into the
 * active UI language — the standard convention for language pickers, and it
 * sidesteps needing a translation to name a translation. Falls back to the
 * raw tag for any locale without an entry.
 */
export const getLocaleLabel = (locale: string): string =>
    LOCALE_LABELS[locale] ?? locale
