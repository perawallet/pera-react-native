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
    injectMlkitSimulatorExclusion,
    MLKIT_FRAMEWORKS,
} from '../withMLKitSimulatorExclusion'

const PODFILE_WITH_RN_POST_INSTALL = `require 'json'

target 'Pera7Dev' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`

describe('injectMlkitSimulatorExclusion', () => {
    it('injects the exclusion ruby after react_native_post_install', () => {
        const result = injectMlkitSimulatorExclusion(
            PODFILE_WITH_RN_POST_INSTALL,
        )

        // Runs after react_native_post_install so our xcconfig edits win.
        const rnIndex = result.indexOf('react_native_post_install(')
        const ourIndex = result.indexOf('Dir.glob')
        expect(ourIndex).toBeGreaterThan(rnIndex)

        // Still inside the post_install block (before its closing `end`s).
        expect(result).toContain('Dir.glob')
        for (const framework of MLKIT_FRAMEWORKS) {
            expect(result).toContain(framework)
        }

        // The Ruby `$1` backreference must survive verbatim — String.replace
        // would otherwise interpret it as the JS regex capture group.
        expect(result).toContain('base_value = $1')
        expect(result).not.toContain('base_value = react_native_post_install')

        // MLKit + the scanner lib are re-added on device only; the base (which
        // the simulator inherits) is left clean.
        expect(result).toContain('OTHER_LDFLAGS[sdk=iphoneos*]')
        expect(result).toContain('-l"VisionCameraBarcodeScanner"')
        expect(result).toContain(
            'EXCLUDED_SOURCE_FILE_NAMES[sdk=iphonesimulator*]',
        )
    })

    it('is idempotent — a second pass does not double-inject', () => {
        const once = injectMlkitSimulatorExclusion(PODFILE_WITH_RN_POST_INSTALL)
        const twice = injectMlkitSimulatorExclusion(once)
        expect(twice).toBe(once)
    })

    it('falls back to opening the post_install block when RN hook is absent', () => {
        const podfile = `target 'Pera7Dev' do
  post_install do |installer|
    some_other_thing(installer)
  end
end
`
        const result = injectMlkitSimulatorExclusion(podfile)
        expect(result).toContain('OTHER_LDFLAGS[sdk=iphoneos*]')
        expect(result).toContain('post_install do |installer|')
    })

    it('appends a post_install block when the Podfile has none', () => {
        const podfile = `target 'Pera7Dev' do\n  use_expo_modules!\nend\n`
        const result = injectMlkitSimulatorExclusion(podfile)
        expect(result).toContain('post_install do |installer|')
        expect(result).toContain('Target Support Files')
    })
})
