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

import { noUnvalidatedOpenUrl } from './rules/no-unvalidated-open-url.js'
import { noPlatformOsWeb } from './rules/no-platform-os-web.js'
import { noHardcodedUiStrings } from './rules/no-hardcoded-ui-strings.js'
import { devGalleryEntryPoints } from './rules/dev-gallery-entry-points.js'
import { noProgramSignerInDappPaths } from './rules/no-program-signer-in-dapp-paths.js'
import { wcConnectorOwnership } from './rules/wc-connector-ownership.js'
import { decimalConstruction } from './rules/decimal-construction.js'
import { moduleEntryNamedExports } from './rules/module-entry-named-exports.js'
import { hookResultType } from './rules/hook-result-type.js'

// A mobile-source rule needs its own override in apps/mobile/.oxlintrc.json:
// oxlint resolves an inherited override's globs from the extending config's
// directory, so a root apps/mobile/src/** override never reaches mobile.
export default {
    meta: { name: 'pera' },
    rules: {
        'no-unvalidated-open-url': noUnvalidatedOpenUrl,
        'no-platform-os-web': noPlatformOsWeb,
        'no-hardcoded-ui-strings': noHardcodedUiStrings,
        'dev-gallery-entry-points': devGalleryEntryPoints,
        'no-program-signer-in-dapp-paths': noProgramSignerInDappPaths,
        'wc-connector-ownership': wcConnectorOwnership,
        'decimal-construction': decimalConstruction,
        'module-entry-named-exports': moduleEntryNamedExports,
        'hook-result-type': hookResultType,
    },
}
