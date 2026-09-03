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

/* eslint-disable @typescript-eslint/no-require-imports */
const { withPodfile } = require('expo/config-plugins')

/*
 * Make iOS *simulator* builds work on Apple Silicon with the latest (arm64-only)
 * simulator runtimes.
 *
 * `react-native-vision-camera-barcode-scanner` links GoogleMLKit, whose static
 * frameworks ship an arm64 slice built for **device only** (Mach-O platform
 * iOS, not iOS-simulator) and no arm64-simulator slice. MLKit's own podspecs
 * therefore set `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`, forcing the
 * whole app to build the simulator as x86_64. iOS 26+ simulator runtimes are
 * arm64-only (no x86_64), so an x86_64 build matches no available simulator and
 * `xcodebuild` reports "Unable to find a destination matching ...".
 *
 * MLKit/camera scanning can't run on a simulator anyway (no camera), so we drop
 * MLKit from the simulator build entirely and keep it untouched for device:
 *   1. Remove the `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` lines so the
 *      simulator builds arm64 like everything else.
 *   2. Skip compiling the barcode-scanner pod's (MLKit-using) sources on the
 *      simulator — its empty static lib still links fine.
 *   3. Drop the MLKit frameworks from the app's link flags on the simulator.
 * The JS side isolates the scanner import behind a device-only lazy boundary
 * (see components/QRScannerView), so nothing references MLKit on the simulator.
 *
 * Implemented as a Podfile `post_install` hook because that is the only step
 * that runs on EVERY `pod install` — including the one `expo run:ios` performs
 * internally (post-prebuild Node scripts do not run on that path).
 */

const MARKER = 'Pera: exclude device-only GoogleMLKit from the iOS simulator'

// MLKit static frameworks linked by the app — none ship an arm64-simulator slice.
const MLKIT_FRAMEWORKS = [
    'MLImage',
    'MLKitBarcodeScanning',
    'MLKitCommon',
    'MLKitVision',
]

// The pod whose sources `import` MLKit; skipped on the simulator.
const SCANNER_POD = 'VisionCameraBarcodeScanner'

// Ruby executed at `pod install` time, inside the Podfile's post_install hook.
// Edits the generated `Target Support Files/**/*.xcconfig` after CocoaPods has
// written them. Idempotent and device-build-safe (every change is scoped to
// `[sdk=iphonesimulator*]`).
const RUBY_BLOCK = `
    # ${MARKER} build (Apple Silicon arm64 simulator support).
    mlkit_frameworks = ${JSON.stringify(MLKIT_FRAMEWORKS).replace(/"/g, "'")}
    support_files_dir = File.join(installer.sandbox.root, 'Target Support Files')
    Dir.glob(File.join(support_files_dir, '**', '*.xcconfig')).each do |xcconfig_path|
      contents = File.read(xcconfig_path)
      original = contents.dup
      base_name = File.basename(xcconfig_path)

      # 1) Let the simulator build arm64 (MLKit's podspec forces it off).
      contents = contents.gsub(/^[ \\t]*EXCLUDED_ARCHS\\[sdk=iphonesimulator\\*\\][ \\t]*=[ \\t]*arm64[ \\t]*\\r?\\n/, '')

      # 2) App aggregate: link the device-only MLKit frameworks + the scanner
      #    static lib on the *device* only. We strip them from the unconditional
      #    base (so the simulator, which has no [sdk=iphonesimulator*] override,
      #    links clean) and re-add them in a [sdk=iphoneos*] override via
      #    $(inherited). (A sim-specific override would NOT work: it begins with
      #    $(inherited), which chains in the unconditional base and re-imports
      #    them.) The scanner lib must go too — step 3 leaves it with no compiled
      #    sources on the simulator, so '-l"${SCANNER_POD}"' is "library not found".
      if base_name.start_with?('Pods-') && contents =~ /^OTHER_LDFLAGS = (.*)$/ && !contents.include?('OTHER_LDFLAGS[sdk=iphoneos*]')
        base_value = $1
        device_only = []
        mlkit_frameworks.each do |fw|
          token = %Q( -framework "#{fw}")
          if base_value.include?(token)
            base_value = base_value.gsub(token, '')
            device_only << %Q(-framework "#{fw}")
          end
        end
        scanner_token = %Q( -l"${SCANNER_POD}")
        if base_value.include?(scanner_token)
          base_value = base_value.gsub(scanner_token, '')
          device_only << %Q(-l"${SCANNER_POD}")
        end
        unless device_only.empty?
          contents = contents.sub(/^OTHER_LDFLAGS = .*$/) { %Q(OTHER_LDFLAGS = #{base_value}\\nOTHER_LDFLAGS[sdk=iphoneos*] = $(inherited) #{device_only.join(' ')}) }
        end
      end

      # 3) Barcode-scanner pod: skip its MLKit-using sources on the simulator.
      if base_name.start_with?('${SCANNER_POD}') && !contents.include?('EXCLUDED_SOURCE_FILE_NAMES[sdk=iphonesimulator*]')
        contents = contents + "EXCLUDED_SOURCE_FILE_NAMES[sdk=iphonesimulator*] = *\\n"
      end

      File.write(xcconfig_path, contents) if contents != original
    end
`

/**
 * Inject the simulator-exclusion Ruby into a Podfile's `post_install` hook.
 *
 * Inserts AFTER the `react_native_post_install(...)` call when present (so our
 * xcconfig edits win over anything React Native's post_install writes),
 * otherwise right after `post_install do |installer|`, otherwise appends a new
 * `post_install` block. Idempotent: a second call is a no-op.
 *
 * @param {string} contents - the Podfile contents
 * @returns {string}
 */
function injectMlkitSimulatorExclusion(contents) {
    if (contents.includes(MARKER)) {
        return contents
    }

    // Function replacements (not string) so `$1`/`$&` inside the Ruby block are
    // emitted verbatim rather than treated as regex backreferences.
    const afterRnPostInstall =
        /react_native_post_install\([\s\S]*?\n[ \t]*\)\n/
    if (afterRnPostInstall.test(contents)) {
        return contents.replace(afterRnPostInstall, match => match + RUBY_BLOCK)
    }

    const postInstallOpen = /post_install do \|installer\|\n/
    if (postInstallOpen.test(contents)) {
        return contents.replace(postInstallOpen, match => match + RUBY_BLOCK)
    }

    return `${contents}\npost_install do |installer|${RUBY_BLOCK}end\n`
}

/**
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withMLKitSimulatorExclusion = config => {
    return withPodfile(config, podfileConfig => {
        podfileConfig.modResults.contents = injectMlkitSimulatorExclusion(
            podfileConfig.modResults.contents,
        )
        return podfileConfig
    })
}

module.exports = Object.assign(withMLKitSimulatorExclusion, {
  injectMlkitSimulatorExclusion,
  MLKIT_FRAMEWORKS,
})
