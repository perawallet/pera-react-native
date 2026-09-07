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
import {
    injectBackupExclusion,
    setAndroidBackupAttributes,
} from '../withExcludeDataFromBackup'

const CALL = 'excludePeraDataFromBackupIfNeeded()'

// Minimal stand-in for the Expo iOS AppDelegate.swift template carrying the two
// anchors the plugin relies on.
const TEMPLATE = `import Expo
import UIKit

@main
class AppDelegate: ExpoAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.moduleName = "main"
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`

describe('injectBackupExclusion', () => {
    it('injects the helper function and calls it first in didFinishLaunchingWithOptions', () => {
        const result = injectBackupExclusion(TEMPLATE)

        expect(result).toContain(`func ${CALL.replace('()', '')}()`)
        expect(result).toContain('isExcludedFromBackup = true')
        // Call is inserted as the first statement of the launch handler.
        expect(result).toMatch(
            /\) -> Bool \{\n\s*excludePeraDataFromBackupIfNeeded\(\)/,
        )
        // Function is declared above the AppDelegate class.
        expect(result.indexOf(`func ${CALL.replace('()', '')}`)).toBeLessThan(
            result.indexOf('class AppDelegate'),
        )
    })

    it('is idempotent — a second pass makes no further changes', () => {
        const once = injectBackupExclusion(TEMPLATE)
        const twice = injectBackupExclusion(once)

        expect(twice).toBe(once)
        // one call site + the function declaration line
        expect(twice.split(CALL).length - 1).toBe(2)
    })

    it('throws loudly if the AppDelegate class anchor is missing', () => {
        const noAnchor = TEMPLATE.replace(
            '@main\nclass AppDelegate',
            'class Other',
        )

        expect(() => injectBackupExclusion(noAnchor)).toThrow(
            /could not find the `@main class AppDelegate` anchor/,
        )
    })

    it('throws loudly if the didFinishLaunchingWithOptions anchor is missing', () => {
        const noLaunch = TEMPLATE.replace(
            /didFinishLaunchingWithOptions[\s\S]*?\) -> Bool \{\n/,
            'applicationDidStart() -> Bool {\n',
        )

        expect(() => injectBackupExclusion(noLaunch)).toThrow(
            /could not find the didFinishLaunchingWithOptions anchor/,
        )
    })
})

describe('setAndroidBackupAttributes', () => {
    const manifestWithApp = () => ({
        manifest: {
            application: [{ $: { 'android:name': '.MainApplication' } }],
        },
    })

    it('wires allowBackup=false and the exclude-all rule resources', () => {
        const result = setAndroidBackupAttributes(manifestWithApp())
        const app = result.manifest.application?.[0].$

        expect(app?.['android:allowBackup']).toBe('false')
        expect(app?.['android:dataExtractionRules']).toBe(
            '@xml/pera_data_extraction_rules',
        )
        expect(app?.['android:fullBackupContent']).toBe(
            '@xml/pera_backup_rules',
        )
    })

    it('throws loudly if the <application> node is missing', () => {
        expect(() => setAndroidBackupAttributes({ manifest: {} })).toThrow(
            /no <application>/,
        )
    })
})
