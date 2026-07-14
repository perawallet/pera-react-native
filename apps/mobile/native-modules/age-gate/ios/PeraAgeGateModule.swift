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

import ExpoModulesCore
import UIKit

#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

/// Surfaces Apple's `DeclaredAgeRange` system prompt (iOS 26+). Payload
/// contract consumed by RNAgeGateService: `requestAgeRange` resolves
/// `{ status: 'sharing' | 'declined' | 'unknown', lowerBound?, upperBound? }`;
/// failures resolve to the unknown payload rather than rejecting. Requires the
/// `com.apple.developer.declared-age-range` entitlement (set in
/// `app.config.builder.js`).
public class PeraAgeGateModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PeraAgeGate")

    AsyncFunction("getDeviceCapability") { () -> String in
      if #available(iOS 26.0, *) {
        return "platform"
      }
      return "manual"
    }

    AsyncFunction("requestAgeRange") { (minimumAge: Int, promise: Promise) in
      #if canImport(DeclaredAgeRange)
      if #available(iOS 26.0, *) {
        Task { @MainActor in
          // requestAgeRange anchors its system UI to a view controller.
          guard let anchor = Self.topViewController() else {
            promise.resolve(["status": "unknown"])
            return
          }
          do {
            let response = try await AgeRangeService.shared.requestAgeRange(
              ageGates: minimumAge,
              in: anchor
            )
            switch response {
            case .sharing(let range):
              var payload: [String: Any] = ["status": "sharing"]
              if let lower = range.lowerBound { payload["lowerBound"] = lower }
              if let upper = range.upperBound { payload["upperBound"] = upper }
              promise.resolve(payload)
            case .declinedSharing:
              promise.resolve(["status": "declined"])
            @unknown default:
              promise.resolve(["status": "unknown"])
            }
          } catch {
            promise.resolve(["status": "unknown"])
          }
        }
      } else {
        promise.resolve(["status": "unknown"])
      }
      #else
      promise.resolve(["status": "unknown"])
      #endif
    }
  }

  // Walks to the currently-presented view controller on the active scene.
  @MainActor
  private static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
      ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first

    let keyWindow = scene?.windows.first { $0.isKeyWindow } ?? scene?.windows.first
    var top = keyWindow?.rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }
}
