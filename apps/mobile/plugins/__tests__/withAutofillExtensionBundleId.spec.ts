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

import { describe, expect, it } from 'vitest'
import { retargetExtensionBundleId } from '../withAutofillExtensionBundleId'

type BuildSettings = { PRODUCT_BUNDLE_IDENTIFIER?: string }
type Section = Record<string, { buildSettings?: BuildSettings } | string>

const fakeProject = (section: Section) => ({
    pbxXCBuildConfigurationSection: () => section,
})

const bundleId = (section: Section, key: string) =>
    (section[key] as { buildSettings: BuildSettings }).buildSettings
        .PRODUCT_BUNDLE_IDENTIFIER

describe('retargetExtensionBundleId', () => {
    it('rewrites every matching extension config to the passed suffix', () => {
        // Two configs so it proves all are rewritten (not just the first), and
        // the passed suffix is what lands (not a hardcoded value).
        const section: Section = {
            EXT_DEBUG: {
                buildSettings: {
                    PRODUCT_BUNDLE_IDENTIFIER:
                        '"com.algorandllc.algorand.PasskeyAutofillCredentialProvider"',
                },
            },
            EXT_RELEASE: {
                buildSettings: {
                    PRODUCT_BUNDLE_IDENTIFIER:
                        '"com.algorandllc.algorand.PasskeyAutofillCredentialProvider"',
                },
            },
        }

        retargetExtensionBundleId(
            fakeProject(section) as never,
            '.autofill-extension',
        )

        expect(bundleId(section, 'EXT_DEBUG')).toBe(
            '"com.algorandllc.algorand.autofill-extension"',
        )
        expect(bundleId(section, 'EXT_RELEASE')).toBe(
            '"com.algorandllc.algorand.autofill-extension"',
        )
    })

    it('leaves the app target and unrelated targets untouched', () => {
        const section: Section = {
            APP: {
                buildSettings: {
                    PRODUCT_BUNDLE_IDENTIFIER: 'com.algorandllc.algorand',
                },
            },
            OTHER: {
                buildSettings: {
                    PRODUCT_BUNDLE_IDENTIFIER:
                        '"com.algorandllc.algorand.some-other-extension"',
                },
            },
        }

        retargetExtensionBundleId(
            fakeProject(section) as never,
            '.autofill-extension',
        )

        expect(bundleId(section, 'APP')).toBe('com.algorandllc.algorand')
        expect(bundleId(section, 'OTHER')).toBe(
            '"com.algorandllc.algorand.some-other-extension"',
        )
    })

    it('ignores _comment keys and configs without build settings', () => {
        const section: Section = {
            EXT_DEBUG_comment: 'Debug',
            EMPTY: {},
        }

        expect(() =>
            retargetExtensionBundleId(
                fakeProject(section) as never,
                '.autofill-extension',
            ),
        ).not.toThrow()
    })
})
