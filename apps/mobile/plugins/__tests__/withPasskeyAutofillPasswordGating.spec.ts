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

type AndroidManifest = {
    $?: Record<string, string>
    application?: {
        service?: { $: Record<string, string> }[]
        'meta-data'?: { $: Record<string, string> }[]
    }[]
}

type ApplyAutofillServiceGating = (
    manifest: AndroidManifest,
    providesPasswords: boolean,
) => AndroidManifest

// Exported by our local patch for the same reason `extensionInfoPlist` is: the
// service is declared in the library's own manifest, so the only way to check
// the gating without it is a full prebuild plus a manifest merge.
const {
    applyAutofillServiceGating,
}: {
    applyAutofillServiceGating: ApplyAutofillServiceGating
} = require('@algorandfoundation/react-native-passkey-autofill/app.plugin.js')

const AUTOFILL_SERVICE_NAME =
    'co.algorand.passkeyautofill.autofill.PeraAutofillService'

const manifestWithApplication = (): AndroidManifest => ({
    application: [{}],
})

describe('passkey-autofill applyAutofillServiceGating — Android service gating', () => {
    it('production (providesPasswords: false) withdraws the service from the merged manifest', () => {
        const manifest = manifestWithApplication()

        applyAutofillServiceGating(manifest, false)

        const service = manifest.application?.[0].service?.find(
            entry => entry.$['android:name'] === AUTOFILL_SERVICE_NAME,
        )
        expect(service?.$['tools:node']).toBe('remove')
        expect(manifest.$?.['xmlns:tools']).toBe(
            'http://schemas.android.com/tools',
        )
    })

    it('non-production (providesPasswords: true) leaves the manifest untouched', () => {
        const manifest = manifestWithApplication()

        applyAutofillServiceGating(manifest, true)

        expect(manifest.application?.[0].service).toBeUndefined()
        expect(manifest.$).toBeUndefined()
    })

    it('marks an already-present service entry for removal rather than duplicating it', () => {
        const manifest: AndroidManifest = {
            application: [
                {
                    service: [
                        { $: { 'android:name': AUTOFILL_SERVICE_NAME } },
                        { $: { 'android:name': 'com.example.OtherService' } },
                    ],
                },
            ],
        }

        applyAutofillServiceGating(manifest, false)

        const services = manifest.application?.[0].service ?? []
        expect(
            services.filter(
                entry => entry.$['android:name'] === AUTOFILL_SERVICE_NAME,
            ),
        ).toHaveLength(1)
        expect(services[0].$['tools:node']).toBe('remove')
        expect(services[1].$['tools:node']).toBeUndefined()
    })
})

const {
    applyAutofillPickerComponent,
    validateAutofillPickerComponent,
} = require('@algorandfoundation/react-native-passkey-autofill/app.plugin.js')

const PICKER_META_DATA_NAME =
    'co.algorand.passkeyautofill.AUTOFILL_PICKER_COMPONENT'

describe('passkey-autofill applyAutofillPickerComponent', () => {
    it('writes the component name as application meta-data', () => {
        const manifest: AndroidManifest = { application: [{}] }

        applyAutofillPickerComponent(manifest, 'PeraAutofillPicker')

        const entry = manifest.application?.[0]['meta-data']?.find(
            m => m.$['android:name'] === PICKER_META_DATA_NAME,
        )
        expect(entry?.$['android:value']).toBe('PeraAutofillPicker')
    })

    it('overwrites an existing entry rather than duplicating it', () => {
        const manifest = {
            application: [
                {
                    'meta-data': [
                        {
                            $: {
                                'android:name': PICKER_META_DATA_NAME,
                                'android:value': 'Stale',
                            },
                        },
                    ],
                },
            ],
        }

        applyAutofillPickerComponent(manifest, 'PeraAutofillPicker')

        const entries = manifest.application[0]['meta-data'].filter(
            m => m.$['android:name'] === PICKER_META_DATA_NAME,
        )
        expect(entries).toHaveLength(1)
        expect(entries[0].$['android:value']).toBe('PeraAutofillPicker')
    })
})

describe('passkey-autofill validateAutofillPickerComponent', () => {
    it('throws when passwords are provided but no component is named', () => {
        expect(() =>
            validateAutofillPickerComponent({ providesPasswords: true }),
        ).toThrow(/autofillPickerComponent/)
    })

    it('throws when the component name is blank', () => {
        expect(() =>
            validateAutofillPickerComponent({
                providesPasswords: true,
                autofillPickerComponent: '   ',
            }),
        ).toThrow(/autofillPickerComponent/)
    })

    it('accepts a missing component when passwords are not provided', () => {
        expect(() =>
            validateAutofillPickerComponent({ providesPasswords: false }),
        ).not.toThrow()
    })
})
