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
import CoreBluetooth

/// Surfaces the iOS system "Turn on Bluetooth" alert. iOS cannot toggle
/// Bluetooth programmatically; initializing a `CBCentralManager` with
/// `CBCentralManagerOptionShowPowerAlertKey: true` while Bluetooth is off
/// presents the system alert. The manager is retained at static scope so it
/// survives past the call (a manager released before CoreBluetooth finishes
/// initializing never presents the alert).
public class PeraBluetoothModule: Module {
  private static var powerAlertManager: CBCentralManager?

  public func definition() -> ModuleDefinition {
    Name("PeraBluetooth")

    AsyncFunction("requestEnable") { () -> Bool in
      if PeraBluetoothModule.powerAlertManager == nil {
        PeraBluetoothModule.powerAlertManager = CBCentralManager(
          delegate: nil,
          queue: nil,
          options: [CBCentralManagerOptionShowPowerAlertKey: true]
        )
      }
      // iOS can't report whether the user acted (the alert deep-links to
      // Settings). Resolve true to signal the prompt was surfaced.
      return true
    }.runOnQueue(.main)
  }
}
