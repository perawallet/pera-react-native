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
    // `localizedFallbackTitle` is left alone, so iOS offers "Enter Passcode"
    // after a failed attempt; tapping it is the user declining, not a failure.
    // userCancel/userFallback both mean the user declined, so both collapse to
    // `userCancel`; systemCancel/appCancel both mean the OS interrupted with no
    // user action, so both collapse to `systemCancel` — the JS side only needs
    // to distinguish "declined" from "retry".
    case .userCancel, .userFallback: self = .userCancel
    case .systemCancel, .appCancel: self = .systemCancel
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
  private static let logTag = "PeraBiometricBinding"

  public func definition() -> ModuleDefinition {
    Name("PeraBiometricBinding")

    // Deliberately ceremony-free: the public half does the wrapping, and the
    // legacy migration path arms with no user present.
    AsyncFunction("armBinding") { () -> [String: String]? in
      // Delete first so this is idempotent: a stale key with the same tag makes
      // SecKeyCreateRandomKey fail, and the service layer only logs that.
      Self.deleteKeyPair()

      let privateKey: SecKey
      do {
        privateKey = try Self.createKeyPair()
      } catch {
        // Device QA is the only verification this has, and a nil return reads
        // the same in JS whatever caused it. The reason has to be logged here
        // or it is lost: no passcode set, no Secure Enclave, denied Face ID.
        NSLog(
          "[%@] creating the key pair failed: %@",
          Self.logTag,
          error.localizedDescription
        )
        return nil
      }

      guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
        NSLog("[%@] the new key pair has no readable public half", Self.logTag)
        Self.deleteKeyPair()
        return nil
      }

      var token = Data(count: 32)
      let status = token.withUnsafeMutableBytes {
        SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!)
      }
      guard status == errSecSuccess else {
        NSLog("[%@] the token RNG failed: %d", Self.logTag, status)
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
        Self.logCFError(error, "wrapping the token failed")
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

      // `withExtendedLifetime` is load-bearing, not decoration: `context` has no
      // use after the lookup, ARC is free to release it there, and
      // `LAContext.deinit` invalidates the evaluated credential. Only optimised
      // builds do that, so without this the decrypt fails in Release after a
      // ceremony the user just passed.
      return try withExtendedLifetime(context) { () -> Data in
        // Named rather than `Self`, which would capture the module in a closure
        // the concurrent overload requires to be @Sendable.
        guard
          let privateKey = PeraBiometricBindingModule.loadKeyPair(context: context)
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
          PeraBiometricBindingModule.logCFError(
            error,
            "unwrapping the token failed"
          )
          // Not the enrollment-change case: that removes the key outright and
          // is answered by `no-binding` above. Reaching here means the key is
          // present but its material can no longer be used.
          throw UnwrapException(.invalidated)
        }
        return token
      }
    }

    AsyncFunction("checkBinding") { () -> String in
      // Retrieval needs no authentication, so a key that is present and intact
      // answers here without a prompt. iOS removes the key outright when the
      // enrolled set changes, so a miss cannot be told apart from never having
      // had one — both report absent, and both are recoverable the same way.
      //
      // `interactionNotAllowed` makes the silence structural: this runs on every
      // mount of the lock screen, where a sheet would be a bug.
      let silent = LAContext()
      silent.interactionNotAllowed = true

      switch Self.copyKeyPair(context: silent).status {
      case errSecSuccess:
        return "valid"
      // Presence, not absence, and the intuitive reading is the wrong one: the
      // status says the item is there and would need UI to release, which is
      // the UI this call just refused.
      case errSecInteractionNotAllowed:
        return "valid"
      case errSecItemNotFound:
        return "absent"
      // Only 'absent' and 'changed' destroy the opt-in, so an unexpected status
      // must report the reading it actually is: none.
      default:
        return "unavailable"
      }
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
    return copyKeyPair(context: context).key
  }

  /// The status matters to `checkBinding`, which has to tell "no key" apart from
  /// "could not take a reading".
  private static func copyKeyPair(
    context: LAContext? = nil
  ) -> (status: OSStatus, key: SecKey?) {
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
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess else { return (status, nil) }
    // Swift rejects `as?` to a CF type, so the type id is the check: on the
    // unlock path of a wallet, degrading to 'no-binding' beats a crash.
    guard let item, CFGetTypeID(item) == SecKeyGetTypeID() else {
      return (status, nil)
    }
    return (status, (item as! SecKey))
  }

  private static func deleteKeyPair() {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: keyTag,
    ]
    let status = SecItemDelete(query as CFDictionary)
    // Nothing to delete is the common case, not a failure.
    if status != errSecSuccess && status != errSecItemNotFound {
      NSLog("[%@] deleting the key pair failed: %d", logTag, status)
    }
  }

  /// Takes the `+1` reference the `Sec*` calls hand back — leaving it would leak
  /// the `CFError` and throw away the only account of why a device failed.
  private static func logCFError(_ error: Unmanaged<CFError>?, _ what: String) {
    guard let cfError = error?.takeRetainedValue() else {
      NSLog("[%@] %@, with no reason reported", logTag, what)
      return
    }
    NSLog("[%@] %@: %@", logTag, what, (cfError as Error).localizedDescription)
  }
}
