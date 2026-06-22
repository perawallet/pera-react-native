/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import ExpoModulesCore

/// Writes the keystore master key to the shared passkey-autofill store as raw
/// bytes, so a non-zeroable hex string never has to exist in the JS heap.
///
/// This intentionally mirrors the write contract of
/// `@algorandfoundation/react-native-passkey-autofill`'s iOS
/// `PasskeyCredentialStore.saveMasterKey` — the master key lives in the App
/// Group `UserDefaults` under `ReactNativePasskeyAutofillMasterKey` as the
/// base64url of the raw secret bytes. The credential-provider extension reads
/// it back via `Data(base64URLEncoded:)`. The only difference is the input:
/// the external module receives a hex `String` and decodes it; we receive the
/// raw bytes directly, so the secret never becomes a JS string.
///
/// Runs in the main app process (where the bootstrap runs), which carries the
/// same App Group entitlement and Info.plist key the extension does.
public class PeraPasskeyAutofillSecretsModule: Module {
  private static let appGroupInfoKey = "ReactNativePasskeyAutofillAppGroup"
  private static let masterKeyDefaultsKey = "ReactNativePasskeyAutofillMasterKey"

  public func definition() -> ModuleDefinition {
    Name("PeraPasskeyAutofillSecrets")

    AsyncFunction("setMasterKey") { (secret: Data) -> Bool in
      // Wipe our native copy once we're done — mirrors the JS-side
      // `Buffer.fill(0)` so the secret doesn't linger in native heap either.
      var bytes = secret
      defer { bytes.resetBytes(in: 0..<bytes.count) }

      guard
        let appGroup = Bundle.main.object(
          forInfoDictionaryKey: Self.appGroupInfoKey
        ) as? String,
        let defaults = UserDefaults(suiteName: appGroup)
      else {
        throw NSError(
          domain: "PeraPasskeyAutofillSecrets",
          code: 1,
          userInfo: [
            NSLocalizedDescriptionKey:
              "App Group is not configured for passkey autofill."
          ]
        )
      }

      defaults.set(
        Self.base64URLEncodedString(bytes),
        forKey: Self.masterKeyDefaultsKey
      )
      return true
    }
  }

  /// base64url without padding — matches the external module's
  /// `Data.base64URLEncodedString()` so its `Data(base64URLEncoded:)` reader
  /// round-trips the value.
  private static func base64URLEncodedString(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}
