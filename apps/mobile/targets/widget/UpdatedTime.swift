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

// No UI frameworks: the WidgetCore package compiles this file for its unit tests.

/// When a widget's figures are from, as a clock time ("14:05"), with the day added once it is no
/// longer today. A time stays true between redraws, which Android widgets can't do every minute; the
/// Apple Watch and the Android widgets show the same.
enum UpdatedTime {
    static func text(
        for date: Date, now: Date, locale: Locale, timeZone: TimeZone = .current
    ) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        // The data's clock can run slightly ahead of the phone's; never show a time still to come.
        let shown = min(date, now)
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.setLocalizedDateFormatFromTemplate(
            calendar.isDate(shown, inSameDayAs: now) ? "jmm" : "dMMMjmm"
        )
        return formatter.string(from: shown)
    }
}
