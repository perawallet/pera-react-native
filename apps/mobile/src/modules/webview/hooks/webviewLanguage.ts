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
 * What the bridge advertises when we have no usable app locale. Deliberately a
 * region-qualified tag rather than bare `en`: it is the value `getPublicSettings`
 * hardcoded before this existed, so keeping it means the no-locale path cannot
 * change what Discover already receives.
 */
export const WEBVIEW_FALLBACK_LANGUAGE = 'en-US'

/**
 * The language tag the webview bridge reports to Discover.
 *
 * Pass i18next's *resolved* locale (`i18n.language`), not the stored
 * preference: the preference can be the `'system'` sentinel, and it is the
 * resolved value that matches what the app is actually rendering in.
 *
 * Falls back when i18next has not initialised yet — `getPublicSettings` is
 * reachable on an unsecured connection, so it can be called before the
 * bootstrap that calls `changeLanguage` has run, and an empty `language` would
 * be worse for the web app than a definite default.
 */
export const resolveWebviewLanguage = (appLocale?: string | null): string => {
    const trimmed = appLocale?.trim()
    return trimmed ? trimmed : WEBVIEW_FALLBACK_LANGUAGE
}
