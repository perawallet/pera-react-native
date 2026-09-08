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

/// Reasons an unwrap can fail, as the exact strings RNBiometricsService maps.
/// Anything it does not recognise degrades to 'unknown', so these raw values
/// are a contract.
internal enum UnwrapError: String {
  case invalidated
  case noBinding = "no-binding"
  case userCancel = "user-cancel"
  case systemCancel = "system-cancel"
  case lockout
  case unavailable
  case failed

  init(from error: LAError) {
    switch error.code {
    case .userCancel, .appCancel: self = .userCancel
    case .systemCancel: self = .systemCancel
    case .biometryLockout: self = .lockout
    case .biometryNotEnrolled, .biometryNotAvailable: self = .unavailable
    // Includes .authenticationFailed and anything a future iOS adds:
    // guessing at an unknown code is worse than reporting a plain failure.
    default: self = .failed
    }
  }
}

/// Expo surfaces a thrown `Exception`'s `code` on the rejected promise, which is
/// the only channel the classification has to reach JavaScript.
internal final class UnwrapException: Exception, @unchecked Sendable {
  // Not named `reason`: `Exception` already declares that as an overridable
  // property, and a stored one cannot shadow it.
  private let failure: UnwrapError

  init(_ failure: UnwrapError) {
    self.failure = failure
    super.init()
  }

  override var code: String { failure.rawValue }
  override var reason: String { "Biometric unwrap failed" }
}

/// Binds biometric unlock to the OS rather than to a stored boolean: the token
/// the wallet needs is wrapped to a Secure Enclave key that only a successful
/// biometric evaluation can use, and that the OS destroys when the enrolled
/// set changes.
///
/// Status contract consumed by RNBiometricsService: `checkBinding` resolves
/// 'valid' | 'changed' | 'absent' | 'unavailable'. iOS never reports 'changed',
/// because `.biometryCurrentSet` removes the key rather than marking it
/// unusable, so a re-enrollment is indistinguishable from a restore or a device
/// upgrade. All of them are recovered the same way — by opting in again.
public class PeraBiometricBindingModule: Module {
  /// The key's identity; there is at most one of these per install.
  private static let keyTag = "pera.biometric.unlock".data(using: .utf8)!

  public func definition() -> ModuleDefinition {
    Name("PeraBiometricBinding")

    // Deliberately ceremony-free: the public half does the wrapping, and the
    // legacy migration path arms with no user present.
    AsyncFunction("armBinding") { () -> [String: String]? in
      // Delete first so this is idempotent: a stale key with the same tag makes
      // SecKeyCreateRandomKey fail, and the service layer only logs that.
      Self.deleteKeyPair()
      guard let privateKey = try? Self.createKeyPair(),
        let publicKey = SecKeyCopyPublicKey(privateKey)
      else { return nil }

      var token = Data(count: 32)
      let status = token.withUnsafeMutableBytes {
        SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!)
      }
      guard status == errSecSuccess else {
        Self.deleteKeyPair()
        return nil
      }
      defer { token.resetBytes(in: 0..<token.count) }

      var error: Unmanaged<CFError>?
      guard
        let ciphertext = SecKeyCreateEncryptedData(
          publicKey,
          .eciesEncryptionCofactorVariableIVX963SHA256AESGCM,
          token as CFData,
          &error
        ) as Data?
      else {
        // A key with no blob to unwrap is orphaned: the reconcile early-returns
        // when there is no blob, so nothing would ever clear it.
        Self.deleteKeyPair()
        return nil
      }

      let digest = SHA256.hash(data: token)
      return [
        "blob": ciphertext.base64EncodedString(),
        "tokenHash": digest.map { String(format: "%02x", $0) }.joined(),
      ]
    }

    AsyncFunction("unwrapToken") {
      (blob: String, prompt: [String: String]) async throws -> Data in
      guard let ciphertext = Data(base64Encoded: blob) else {
        throw UnwrapException(.failed)
      }

      let context = LAContext()
      context.localizedCancelTitle = prompt["cancelLabel"]
      // Evaluate first, then hand the same context to the Keychain, so the user
      // sees one ceremony and the key is released against that evaluation
      // rather than a second, unrelated prompt.
      do {
        _ = try await context.evaluatePolicy(
          .deviceOwnerAuthenticationWithBiometrics,
          localizedReason: prompt["title"] ?? "Authenticate"
        )
      } catch let error as LAError {
        throw UnwrapException(UnwrapError(from: error))
      } catch {
        throw UnwrapException(.failed)
      }

      // Named rather than `Self`, which would capture the module in a closure
      // the concurrent overload requires to be @Sendable.
      guard let privateKey = PeraBiometricBindingModule.loadKeyPair(context: context)
      else {
        throw UnwrapException(.noBinding)
      }

      var error: Unmanaged<CFError>?
      guard
        let token = SecKeyCreateDecryptedData(
          privateKey,
          .eciesEncryptionCofactorVariableIVX963SHA256AESGCM,
          ciphertext as CFData,
          &error
        ) as Data?
      else {
        // A destroyed key surfaces here, not at retrieval.
        throw UnwrapException(.invalidated)
      }
      return token
    }

    AsyncFunction("checkBinding") { () -> String in
      // Retrieval needs no authentication, so a key that is present and intact
      // answers here without a prompt. iOS removes the key outright when the
      // enrolled set changes, so a miss cannot be told apart from never having
      // had one — both report absent, and both are recoverable the same way.
      return Self.loadKeyPair() != nil ? "valid" : "absent"
    }

    AsyncFunction("clearBinding") { () -> Void in
      Self.deleteKeyPair()
    }

    // `LAContext` distinguishes what expo's `isEnrolledAsync` boolean cannot:
    // a lockout (temporary) from an empty enrollment or a revoked per-app Face
    // ID permission (both permanent until the user acts).
    AsyncFunction("getAvailability") { () -> String in
      let context = LAContext()
      var error: NSError?
      if context.canEvaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        error: &error
      ) {
        return "available"
      }

      switch error?.code {
      case LAError.biometryNotEnrolled.rawValue:
        return "none-enrolled"
      case LAError.biometryLockout.rawValue:
        return "unavailable"
      // Covers both "the user denied Face ID for this app" and "no biometric
      // hardware". Only the first is reachable for someone who had biometric
      // unlock switched on, and it is the case worth telling them about.
      case LAError.biometryNotAvailable.rawValue:
        return "denied"
      default:
        return "unknown"
      }
    }
  }

  private static func accessControl() throws -> SecAccessControl {
    var error: Unmanaged<CFError>?
    // WhenPasscodeSetThisDeviceOnly, deliberately: the key must not survive
    // passcode removal, and must never leave the device or enter a backup.
    guard
      let control = SecAccessControlCreateWithFlags(
        nil,
        kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        [.privateKeyUsage, .biometryCurrentSet],
        &error
      )
    else {
      throw error!.takeRetainedValue() as Error
    }
    return control
  }

  private static func createKeyPair() throws -> SecKey {
    let attributes: [String: Any] = [
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecAttrKeySizeInBits as String: 256,
      kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
      kSecPrivateKeyAttrs as String: [
        kSecAttrIsPermanent as String: true,
        kSecAttrApplicationTag as String: keyTag,
        kSecAttrAccessControl as String: try accessControl(),
      ],
    ]
    var error: Unmanaged<CFError>?
    guard let key = SecKeyCreateRandomKey(attributes as CFDictionary, &error)
    else {
      throw error!.takeRetainedValue() as Error
    }
    return key
  }

  /// A reference to the private key. Authentication is required at *use*, not at
  /// retrieval, so this neither prompts nor fails while the key is intact — which
  /// is what makes `checkBinding` silent and the public-key wrap ceremony-free.
  private static func loadKeyPair(context: LAContext? = nil) -> SecKey? {
    var query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: keyTag,
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecReturnRef as String: true,
    ]
    if let context {
      query[kSecUseAuthenticationContext as String] = context
    }
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess
    else { return nil }
    return (item as! SecKey)
  }

  private static func deleteKeyPair() {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: keyTag,
    ]
    SecItemDelete(query as CFDictionary)
  }
}
