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

import Foundation
import React
import CoreBluetooth

/// Surfaces the iOS system "Turn on Bluetooth" alert.
///
/// iOS does not let apps toggle Bluetooth programmatically. The only built-in
/// affordance is CoreBluetooth's power alert, shown when a `CBCentralManager`
/// is initialized with `CBCentralManagerOptionShowPowerAlertKey: true` while
/// Bluetooth is powered off. This mirrors the native iOS app's
/// `BLEConnectionManager.makeCentralManager()`.
///
/// The manager is retained at class scope: a `CBCentralManager` released
/// before CoreBluetooth finishes initializing never presents the alert.
@objc(PeraBluetooth)
final class PeraBluetooth: NSObject {

  // Strong reference so the manager (and therefore the power alert) survives
  // past the `requestEnable` call. Reused across calls — one is enough.
  private static var powerAlertManager: CBCentralManager?

  // CoreBluetooth init + the alert it presents are main-thread concerns.
  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc(requestEnable:rejecter:)
  func requestEnable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      // Instantiating with the power-alert option triggers the system alert
      // when Bluetooth is off. When it's already on this is a harmless no-op.
      if PeraBluetooth.powerAlertManager == nil {
        PeraBluetooth.powerAlertManager = CBCentralManager(
          delegate: nil,
          queue: nil,
          options: [CBCentralManagerOptionShowPowerAlertKey: true]
        )
      }
      // iOS can't report whether the user acted on the alert (it deep-links to
      // Settings). Resolve true to signal the prompt was surfaced.
      resolve(true)
    }
  }
}
