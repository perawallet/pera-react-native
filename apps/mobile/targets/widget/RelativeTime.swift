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
import Foundation

enum RelativeTime {
    /// The moment "Updated … ago" describes: `date` floored to whole minutes before
    /// `now`, or `now` itself under a minute, so the label reads "now" instead of
    /// counting seconds. A `date` in the future also reads as "now".
    static func shownDate(for date: Date, now: Date) -> Date {
        let elapsed = max(0, now.timeIntervalSince(date))
        guard elapsed >= 60 else { return now }
        return now.addingTimeInterval(-(elapsed / 60).rounded(.down) * 60)
    }
}
