import Foundation
import React

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
        do {
          // NOTE: confirm exact API surface against the iOS 26 SDK in Xcode.
          let response = try await AgeRangeService.shared.requestAgeRange(
            ageGates: minimumAge.intValue
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
}
