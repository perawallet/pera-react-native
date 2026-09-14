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

/// The raw values are the contract RNBiometricsService maps; anything it does
/// not recognise degrades to 'unknown'. There is no `invalidated` here: iOS
/// removes a key whose biometric set changed rather than marking it unusable,
/// so that case reads as `noBinding`.
internal enum UnwrapError: String {
  case decryptFailed = "decrypt-failed"
  case noBinding = "no-binding"
  case userCancel = "user-cancel"
  case systemCancel = "system-cancel"
  case lockout
  case unavailable
  case failed

  init(from error: LAError) {
    switch error.code {
    // userFallback is the "Enter Passcode" button, which is the user declining;
    // appCancel is the OS interrupting with no user action. JS only needs
    // "declined" apart from "retry".
    case .userCancel, .userFallback: self = .userCancel
    case .systemCancel, .appCancel: self = .systemCancel
    case .biometryLockout: self = .lockout
    case .biometryNotEnrolled, .biometryNotAvailable: self = .unavailable
    default: self = .failed
    }
  }
}

/// Expo surfaces a thrown `Exception`'s `code` on the rejected promise, which is
/// the only channel the classification has to reach JavaScript.
internal final class UnwrapException: Exception, @unchecked Sendable {
  // `Exception` already declares `reason`, and a stored property cannot shadow it.
  private let failure: UnwrapError

  init(_ failure: UnwrapError) {
    self.failure = failure
    super.init()
  }

  override var code: String { failure.rawValue }
  override var reason: String { "Biometric unwrap failed" }
}

/// The token the wallet needs is wrapped to a Secure Enclave key that only a
/// successful biometric evaluation can use and that the OS destroys when the
/// enrolled set changes.
///
/// `checkBinding` resolves 'valid' | 'absent' | 'unavailable', never 'changed':
/// a re-enrollment is indistinguishable from a restore or a device upgrade, and
/// all of them are recovered by opting in again.
public class PeraBiometricBindingModule: Module {
  private static let keyTag = "pera.biometric.unlock".data(using: .utf8)!
  private static let logTag = "PeraBiometricBinding"

  public func definition() -> ModuleDefinition {
    Name("PeraBiometricBinding")

    // Ceremony-free on purpose: the public half does the wrapping, and the
    // legacy migration arms with no user present.
    AsyncFunction("armBinding") { () -> [String: String]? in
      // A stale key with the same tag makes SecKeyCreateRandomKey fail, so
      // delete first to stay idempotent.
      Self.deleteKeyPair()

      let privateKey: SecKey
      do {
        privateKey = try Self.createKeyPair()
      } catch {
        // A nil return reads the same in JS whatever the cause, so the reason
        // lives only here: no passcode set, no Secure Enclave, denied Face ID.
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
        // The reconcile early-returns without a blob, so a key left behind is
        // never cleared.
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
      // The copy is translated by the caller. An empty reason makes
      // `evaluatePolicy` raise an NSInvalidArgumentException, which is a crash
      // rather than a rejection.
      guard let reason = prompt["title"], !reason.isEmpty else {
        throw UnwrapException(.failed)
      }

      let context = LAContext()
      if let cancelLabel = prompt["cancelLabel"], !cancelLabel.isEmpty {
        context.localizedCancelTitle = cancelLabel
      }
      // Evaluate first, then hand the same context to the Keychain, so the user
      // sees one ceremony and the key is released against that evaluation.
      do {
        _ = try await context.evaluatePolicy(
          .deviceOwnerAuthenticationWithBiometrics,
          localizedReason: reason
        )
      } catch let error as LAError {
        throw UnwrapException(UnwrapError(from: error))
      } catch {
        throw UnwrapException(.failed)
      }

      // `withExtendedLifetime` is load-bearing: `context` has no use after the
      // lookup, an optimised build releases it there, and `LAContext.deinit`
      // invalidates the evaluated credential. Debug hides this by construction.
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
          // Not classified further: nothing here can tell a dead key from a
          // transient refusal, and JS only drops the opt-in once it repeats.
          throw UnwrapException(.decryptFailed)
        }
        return token
      }
    }

    AsyncFunction("checkBinding") { () -> String in
      // Runs on every mount of the lock screen, where a sheet would be a bug;
      // `interactionNotAllowed` makes the silence structural.
      let silent = LAContext()
      silent.interactionNotAllowed = true

      switch Self.copyKeyPair(context: silent).status {
      case errSecSuccess:
        return "valid"
      // Presence, not absence: the item is there and would need the UI this
      // call just refused.
      case errSecInteractionNotAllowed:
        return "valid"
      case errSecItemNotFound:
        return "absent"
      // Only 'absent' destroys the opt-in, so an unexpected status reports no
      // reading.
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
      // Also "no biometric hardware", but only the denied-permission case is
      // reachable for someone who had biometric unlock switched on.
      case LAError.biometryNotAvailable.rawValue:
        return "denied"
      default:
        return "unknown"
      }
    }
  }

  private static func accessControl() throws -> SecAccessControl {
    var error: Unmanaged<CFError>?
    // WhenPasscodeSetThisDeviceOnly: the key must not survive passcode removal,
    // leave the device or enter a backup.
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

  /// Authentication is required at use, not at retrieval, which is what makes
  /// `checkBinding` silent and the public-key wrap ceremony-free.
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
    // Swift rejects `as?` to a CF type, so the type id is the check.
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
    if status != errSecSuccess && status != errSecItemNotFound {
      NSLog("[%@] deleting the key pair failed: %d", logTag, status)
    }
    Self.deleteLegacyEnrollmentBindingItem()
  }

  /// The pre-OS-bound-key digest item. Keychain items survive app deletion, so
  /// an upgrading install never clears it on its own; absence is the normal case.
  private static func deleteLegacyEnrollmentBindingItem() {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "pera.biometricEnrollmentBinding",
    ]
    SecItemDelete(query as CFDictionary)
  }

  /// Takes the `+1` reference the `Sec*` calls hand back; leaving it would leak
  /// the `CFError` and lose the only account of why a device failed.
  private static func logCFError(_ error: Unmanaged<CFError>?, _ what: String) {
    guard let cfError = error?.takeRetainedValue() else {
      NSLog("[%@] %@, with no reason reported", logTag, what)
      return
    }
    NSLog("[%@] %@: %@", logTag, what, (cfError as Error).localizedDescription)
  }
}
