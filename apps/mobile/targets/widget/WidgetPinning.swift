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
import Foundation
import Security

// Self-contained (no snapshot types): the PeraWidgets pod compiles this same file through a symlink,
// and the pod is built for iOS 16.4.

/// SPKI pinning for the widget's backend requests, with the app's pin set.
enum WidgetPinning {
    /// A session that refuses any server whose chain has none of `hashes`; nil once `expiresAt` has
    /// passed, meaning plain TLS. An expiry that doesn't parse keeps the pins: fail closed.
    static func session(hashes: [String], expiresAt: String, now: Date = .now) -> URLSession? {
        guard isActive(expiresAt: expiresAt, now: now) else { return nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        return URLSession(configuration: configuration, delegate: PinningDelegate(pins: Set(hashes)), delegateQueue: nil)
    }

    static func isActive(expiresAt: String, now: Date) -> Bool {
        guard let expiry = parseExpiry(expiresAt) else { return true }
        return now < expiry
    }

    /// System trust must pass first; pinning only narrows which CAs are accepted.
    static func isTrusted(_ trust: SecTrust, pins: Set<String>) -> Bool {
        guard SecTrustEvaluateWithError(trust, nil) else { return false }
        let chain = (SecTrustCopyCertificateChain(trust) as? [SecCertificate]) ?? []
        return chain.contains { certificate in spkiHash(certificate).map(pins.contains) ?? false }
    }

    /// Base64 SHA-256 of the certificate's DER SubjectPublicKeyInfo, as `openssl pkey -pubin -outform DER`
    /// hashes it. Nil for a key type the pins can't contain.
    static func spkiHash(_ certificate: SecCertificate) -> String? {
        guard let key = SecCertificateCopyKey(certificate),
              let attributes = SecKeyCopyAttributes(key) as? [String: Any],
              let type = attributes[kSecAttrKeyType as String] as? String,
              let bits = attributes[kSecAttrKeySizeInBits as String] as? Int,
              let header = spkiHeader(type: type, bits: bits),
              let raw = SecKeyCopyExternalRepresentation(key, nil) as Data?
        else { return nil }
        return Data(SHA256.hash(data: header + raw)).base64EncodedString()
    }

    // Security hands out only the raw key (PKCS#1 for RSA, the X9.63 point for EC), so the
    // SubjectPublicKeyInfo's algorithm identifier and BIT STRING header are put back by hand.
    private static func spkiHeader(type: String, bits: Int) -> Data? {
        let isRSA = type == (kSecAttrKeyTypeRSA as String)
        let isEC = type == (kSecAttrKeyTypeECSECPrimeRandom as String)
        let bytes: [UInt8]
        if isRSA && bits == 2048 {
            bytes = [0x30, 0x82, 0x01, 0x22, 0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01,
                     0x01, 0x05, 0x00, 0x03, 0x82, 0x01, 0x0F, 0x00]
        } else if isRSA && bits == 4096 {
            bytes = [0x30, 0x82, 0x02, 0x22, 0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01,
                     0x01, 0x05, 0x00, 0x03, 0x82, 0x02, 0x0F, 0x00]
        } else if isEC && bits == 256 {
            bytes = [0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01, 0x06, 0x08, 0x2A,
                     0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00]
        } else if isEC && bits == 384 {
            bytes = [0x30, 0x76, 0x30, 0x10, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01, 0x06, 0x05, 0x2B,
                     0x81, 0x04, 0x00, 0x22, 0x03, 0x62, 0x00]
        } else {
            return nil
        }
        return Data(bytes)
    }

    // The app writes either a full timestamp or a bare date ("2027-07-08").
    private static func parseExpiry(_ value: String) -> Date? {
        let full = ISO8601DateFormatter()
        full.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        let day = ISO8601DateFormatter()
        day.formatOptions = [.withFullDate]
        return full.date(from: value) ?? plain.date(from: value) ?? day.date(from: value)
    }
}

private final class PinningDelegate: NSObject, URLSessionDelegate {
    private let pins: Set<String>

    init(pins: Set<String>) {
        self.pins = pins
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        if WidgetPinning.isTrusted(trust, pins: pins) {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}
