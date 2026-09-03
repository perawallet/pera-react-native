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

/* eslint-disable @typescript-eslint/no-require-imports -- the patched
   package ships app.plugin.js as untyped CommonJS */
import { describe, expect, it } from 'vitest'

type ExtensionInfoPlist = (props: {
    label: string
    aaguid: string
    biometricRequirement: string
    supportedDomains: string[]
    providesPasswords: boolean
}) => string

// `extensionInfoPlist` is exported by our local patch (see
// patches/@algorandfoundation__react-native-passkey-autofill@*.patch)
// specifically so the production-vs-non-production plist rendering can be
// pinned by a test without driving a full Xcode/prebuild pipeline.
const {
    extensionInfoPlist,
}: {
    extensionInfoPlist: ExtensionInfoPlist
} = require('@algorandfoundation/react-native-passkey-autofill/app.plugin.js')

const baseProps = {
    label: 'Pera Wallet',
    aaguid: '418a66da-f981-47e8-814f-19c97f97bd4d',
    biometricRequirement: 'strongOrCredential',
    supportedDomains: ['perawallet.app'],
}

describe('passkey-autofill extensionInfoPlist — password-manager gating', () => {
    it('production (providesPasswords: false) keeps ProvidesPasswords false and restores the supported-domains scoping', () => {
        const plist = extensionInfoPlist({
            ...baseProps,
            providesPasswords: false,
        })

        expect(plist).toMatch(/<key>ProvidesPasswords<\/key>\s*<false\/>/)
        expect(plist).toContain(
            '<key>ASCredentialProviderExtensionSupportedDomains</key>',
        )
        expect(plist).toContain('<string>perawallet.app</string>')
    })

    it('non-production (providesPasswords: true) enables ProvidesPasswords and drops the domain scoping', () => {
        const plist = extensionInfoPlist({
            ...baseProps,
            providesPasswords: true,
        })

        expect(plist).toMatch(/<key>ProvidesPasswords<\/key>\s*<true\/>/)
        expect(plist).not.toContain(
            '<key>ASCredentialProviderExtensionSupportedDomains</key>',
        )
    })
})
