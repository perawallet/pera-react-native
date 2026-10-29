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
import { noAlgorandSdkImports } from './rules/no-algorand-sdk-imports.js'
import { noI18nKeyCast } from './rules/no-i18n-key-cast.js'
import { hdDeriveClaimed } from './rules/hd-derive-claimed.js'
import { noManualUnitConversion } from './rules/no-manual-unit-conversion.js'
import { sensitiveInputProps } from './rules/sensitive-input-props.js'
import { monotonicLockoutClock } from './rules/monotonic-lockout-clock.js'
import { noDisplayStringIdentity } from './rules/no-display-string-identity.js'
import { fetchHasDeadline } from './rules/fetch-has-deadline.js'
import { componentPropsType } from './rules/component-props-type.js'
import { noPackageStoreInternals } from './rules/no-package-store-internals.js'
import { testIdProp } from './rules/test-id-prop.js'
import { makeStylesLocation } from './rules/make-styles-location.js'
import { loggerStaticMessage } from './rules/logger-static-message.js'
import { preferLookupMap } from './rules/prefer-lookup-map.js'
import { preferToError } from './rules/prefer-to-error.js'
import { noDeepRelativeImports } from './rules/no-deep-relative-imports.js'
import { typedDomainErrors } from './rules/typed-domain-errors.js'

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
        'no-algorand-sdk-imports': noAlgorandSdkImports,
        'no-i18n-key-cast': noI18nKeyCast,
        'hd-derive-claimed': hdDeriveClaimed,
        'no-manual-unit-conversion': noManualUnitConversion,
        'sensitive-input-props': sensitiveInputProps,
        'monotonic-lockout-clock': monotonicLockoutClock,
        'no-display-string-identity': noDisplayStringIdentity,
        'fetch-has-deadline': fetchHasDeadline,
        'component-props-type': componentPropsType,
        'no-package-store-internals': noPackageStoreInternals,
        'test-id-prop': testIdProp,
        'make-styles-location': makeStylesLocation,
        'logger-static-message': loggerStaticMessage,
        'prefer-lookup-map': preferLookupMap,
        'prefer-to-error': preferToError,
        'no-deep-relative-imports': noDeepRelativeImports,
        'typed-domain-errors': typedDomainErrors,
    },
}
