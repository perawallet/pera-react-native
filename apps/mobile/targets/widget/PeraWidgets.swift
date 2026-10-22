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
import SwiftUI
import WidgetKit

// A bundle's body takes at most 10 entries (an `if` counts as one), so the
// widgets are grouped into nested bundles; add new ones to a group.
@main
struct PeraWidgetBundle: WidgetBundle {
    var body: some Widget {
        PortfolioWidgetBundle().body
        AccountWidgetBundle().body
        InboxWidgetBundle().body
        if #available(iOS 18.0, *) {
            ScanControl()
        }
    }
}

struct PortfolioWidgetBundle: WidgetBundle {
    var body: some Widget {
        PortfolioWidget()
        PortfolioTransactionsWidget()
        PortfolioTransactionsTabsWidget()
        TransactionsWidget()
        PriceWidget()
        NftWidget()
    }
}

struct AccountWidgetBundle: WidgetBundle {
    var body: some Widget {
        CloudBackupWidget()
        PassphraseBackupWidget()
        BackupsWidget()
        ReceiveWidget()
    }
}

struct InboxWidgetBundle: WidgetBundle {
    var body: some Widget {
        InboxWidget()
        InboxListWidget()
        SignaturesWidget()
        NotificationsWidget()
        InboxTabsWidget()
    }
}
