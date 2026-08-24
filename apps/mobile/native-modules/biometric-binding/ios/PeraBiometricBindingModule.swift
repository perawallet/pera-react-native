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

import CryptoKit
import ExpoModulesCore
import LocalAuthentication

/// Detects changes to the enrolled biometric set, so a Face ID / Touch ID
/// enrollment added *after* the user opted in cannot inherit that opt-in.
///
/// `LAContext.evaluatedPolicyDomainState` is an opaque blob whose value changes
/// whenever the biometric database changes; only its equality is meaningful, so
/// this stores a SHA-256 of it rather than the blob itself. Nothing here ever
/// prompts — `canEvaluatePolicy` only reports policy availability.
///
/// Status contract consumed by RNBiometricsService: `checkBinding` resolves
/// 'valid' | 'changed' | 'absent' | 'unavailable', and only 'changed' is an
/// affirmative report that the set was modified.
public class PeraBiometricBindingModule: Module {
  private static let service = "pera.biometricEnrollmentBinding"
  private static let account = "domain-state"

  public func definition() -> ModuleDefinition {
    Name("PeraBiometricBinding")

    AsyncFunction("createBinding") { () -> Bool in
      guard let digest = Self.currentDigest() else { return false }
      return Self.save(digest)
    }

    AsyncFunction("checkBinding") { () -> String in
      guard let stored = Self.load() else { return "absent" }
      // No reading available: nothing enrolled, or biometry is locked out and
      // the policy cannot be evaluated. Either way it is not a report that the
      // enrollment set changed, so the caller must keep the opt-in.
      guard let current = Self.currentDigest() else { return "unavailable" }
      return current == stored ? "valid" : "changed"
    }

    AsyncFunction("clearBinding") { () -> Void in
      Self.delete()
    }
  }

  /// `evaluatedPolicyDomainState` is only populated once the policy has been
  /// evaluated on that context, hence the `canEvaluatePolicy` call first.
  private static func currentDigest() -> Data? {
    let context = LAContext()
    var error: NSError?
    guard
      context.canEvaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        error: &error
      ),
      let state = context.evaluatedPolicyDomainState
    else {
      return nil
    }
    return Data(SHA256.hash(data: state))
  }

  private static func baseQuery() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }

  private static func save(_ digest: Data) -> Bool {
    delete()
    var query = baseQuery()
    query[kSecValueData as String] = digest
    // A digest, not a secret: no access control, and never synced off-device.
    // It has to be readable in the same pass that decides whether the opt-in
    // survives, which runs without user interaction.
    query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
  }

  private static func load() -> Data? {
    var query = baseQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else {
      return nil
    }
    return item as? Data
  }

  private static func delete() {
    SecItemDelete(baseQuery() as CFDictionary)
  }
}
