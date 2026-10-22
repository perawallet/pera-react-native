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

import Darwin
import ExpoModulesCore

/// Payload contract consumed by RNMonotonicClockService: `now()` returns
/// `{ bootId: string, elapsedMs: number }`. `mach_continuous_time` keeps
/// counting while the device sleeps, unlike `mach_absolute_time`, so a lockout
/// served with the screen off still elapses.
public class PeraMonotonicClockModule: Module {
  private static let timebase: mach_timebase_info_data_t = {
    var info = mach_timebase_info_data_t()
    mach_timebase_info(&info)
    return info
  }()

  // Read once per process: the `kern.boottime` fallback shifts when the wall
  // clock is stepped, and a mid-process shift would restart a running lockout.
  private static let bootId: String? = {
    if let uuid = sysctlString("kern.bootsessionuuid") {
      return uuid
    }
    if let seconds = bootTimeSeconds() {
      return "boottime:\(seconds)"
    }
    return nil
  }()

  public func definition() -> ModuleDefinition {
    Name("PeraMonotonicClock")

    Function("now") { () -> [String: Any] in
      // A constant stand-in would let a deadline from before a reboot be
      // trusted after it; failing hands the JS side its wall-clock fallback.
      guard let bootId = Self.bootId else {
        throw BootIdUnavailableException()
      }
      return ["bootId": bootId, "elapsedMs": Self.elapsedMs()]
    }
  }

  private static func elapsedMs() -> Double {
    let ticks = Double(mach_continuous_time())
    return ticks * Double(timebase.numer) / Double(timebase.denom) / 1_000_000
  }

  private static func sysctlString(_ name: String) -> String? {
    var size = 0
    guard sysctlbyname(name, nil, &size, nil, 0) == 0, size > 0 else {
      return nil
    }
    var buffer = [CChar](repeating: 0, count: size)
    guard sysctlbyname(name, &buffer, &size, nil, 0) == 0 else {
      return nil
    }
    let value = String(cString: buffer)
    return value.isEmpty ? nil : value
  }

  private static func bootTimeSeconds() -> Int? {
    var bootTime = timeval()
    var size = MemoryLayout<timeval>.size
    guard sysctlbyname("kern.boottime", &bootTime, &size, nil, 0) == 0 else {
      return nil
    }
    return Int(bootTime.tv_sec)
  }
}

internal final class BootIdUnavailableException: Exception {
  override var reason: String {
    "Neither kern.bootsessionuuid nor kern.boottime is readable"
  }
}
