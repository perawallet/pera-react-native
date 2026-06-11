import Foundation
import React
import UIKit

#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

@objc(PeraAgeGate)
class PeraAgeGate: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc(getDeviceCapability:rejecter:)
  func getDeviceCapability(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 26.0, *) {
      resolve("platform")
    } else {
      resolve("manual")
    }
  }

  @objc(requestAgeRange:resolver:rejecter:)
  func requestAgeRange(_ minimumAge: NSNumber,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 26.0, *) {
      Task { @MainActor in
        // requestAgeRange anchors its system UI to a view controller.
        guard let anchor = Self.topViewController() else {
          resolve(["status": "unknown"])
          return
        }
        do {
          let response = try await AgeRangeService.shared.requestAgeRange(
            ageGates: minimumAge.intValue,
            in: anchor
          )
          switch response {
          case .sharing(let range):
            var payload: [String: Any] = ["status": "sharing"]
            if let lower = range.lowerBound { payload["lowerBound"] = lower }
            if let upper = range.upperBound { payload["upperBound"] = upper }
            resolve(payload)
          case .declinedSharing:
            resolve(["status": "declined"])
          @unknown default:
            resolve(["status": "unknown"])
          }
        } catch {
          resolve(["status": "unknown"])
        }
      }
    } else {
      resolve(["status": "unknown"])
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
