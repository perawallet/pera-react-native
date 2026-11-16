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

import 'i18next'

declare module 'i18next' {
    interface CustomTypeOptions {
        // Strict checks make TFunction unassignable to the app's looser
        // `(key: string, options?) => string` translate helpers.
        strictInterpolationChecks: false
        // Must match `returnEmptyString` in i18n/index.ts.
        returnEmptyString: true
    }
}
