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

/// One row of the recent-transactions list, already classified for display.
struct TransactionRow: Identifiable {
    enum Kind {
        case send, receive, swap, optIn, optOut, appCall, other
    }

    let id: String
    let kind: Kind
    /// Formatted amount with unit ("25 ALGO", "USDC → ALGO"); nil when the
    /// transaction moves nothing worth showing (opt-ins, plain app calls).
    let amount: String?
    let date: Date
}

/// Classifies rows by the app's rules (chain-algorand's summarize.ts and history transformers), read from the
/// side of the account whose page the row came from. The Android widget's TransactionsFetcher.kt does the same.
enum TransactionsFetcher {
    /// One request per account; "Portfolio" reads only the first this many in the app's account order, to stay
    /// inside WidgetKit's few-second budget. The Android widget caps at the same number.
    static let maxAccounts = 5

    private struct Facts {
        let unitName: String
        let decimals: Int
    }

    // ALGO's facts are fixed: the backend sends an `asset(0)` placeholder with 0 decimals when its enrichment fails.
    private static let algo = Facts(unitName: "ALGO", decimals: 6)

    /// Newest first across `addresses`, at most `limit` rows; nil when every request failed.
    static func fetch(
        addresses: [String],
        limit: Int,
        locale: Locale,
        _ feed: WidgetSnapshot.PriceFeed
    ) async -> [TransactionRow]? {
        guard let base = URL(string: feed.backendUrl), !addresses.isEmpty else { return nil }
        let accounts = Array(addresses.prefix(maxAccounts))

        let pages = await withTaskGroup(of: (Int, Page?).self) { group in
            for (index, address) in accounts.enumerated() {
                group.addTask {
                    let page: Page? = await PeraBackend.get(base, "v1/accounts/\(address)/transactions/?limit=\(limit)", feed)
                    return (index, page)
                }
            }
            var results: [(Int, Page?)] = []
            for await page in group { results.append(page) }
            return results
        }
        // Back in account order, whatever order the requests finished in.
        let loaded = pages.sorted { $0.0 < $1.0 }.compactMap { index, page in page.map { (accounts[index], $0) } }
        guard !loaded.isEmpty else { return nil }

        // A transfer between two of the user's accounts appears in both histories. Ties sort by position, so
        // the first account's copy wins on every refresh.
        let items = loaded.flatMap { account, page in page.results.compactMap(\.value).map { (account, $0) } }
        var seen = Set<String>()
        return items.enumerated()
            .sorted { lhs, rhs in
                lhs.element.1.roundTime != rhs.element.1.roundTime
                    ? lhs.element.1.roundTime > rhs.element.1.roundTime
                    : lhs.offset < rhs.offset
            }
            .map(\.element)
            .filter { seen.insert($0.1.id).inserted }
            .prefix(limit)
            .map { row($0.1, account: $0.0, locale: locale) }
    }

    private static func row(_ item: Item, account: String, locale: Locale) -> TransactionRow {
        let date = Date(timeIntervalSince1970: item.roundTime)
        func plain(_ kind: TransactionRow.Kind) -> TransactionRow {
            TransactionRow(id: item.id, kind: kind, amount: nil, date: date)
        }

        if let swap = item.swap_group_detail {
            let from = facts(swap.asset_in).unitName
            let to = facts(swap.asset_out).unitName
            let amount = from.isEmpty || to.isEmpty ? nil : "\(from) → \(to)"
            return TransactionRow(id: item.id, kind: .swap, amount: amount, date: date)
        }

        switch item.tx_type {
        case "pay":
            return transfer(item, account: account, facts: algo, isOut: isOutgoing(item, account, debited: item.sender), date: date, locale: locale)
        case "axfer":
            let assetSender = item.asset_sender ?? derivedClawback(item, account)
            let paid = PeraBackend.decimal(item.amount) ?? 0
            if assetSender == nil && item.sender == item.receiver && paid == 0 && item.close_to == nil {
                return plain(.optIn)
            }
            if assetSender == nil && item.close_to != nil {
                return plain(.optOut)
            }
            let isOut = isOutgoing(item, account, debited: assetSender ?? item.sender)
            return transfer(item, account: account, facts: facts(item.asset), isOut: isOut, date: date, locale: locale)
        case "appl":
            return plain(.appCall)
        default:
            // Key registrations, heartbeats, asset config and freeze, state proofs: no amount, "Transaction".
            return plain(.other)
        }
    }

    private static func transfer(
        _ item: Item, account: String, facts: Facts, isOut: Bool, date: Date, locale: Locale
    ) -> TransactionRow {
        let paid = PeraBackend.decimal(item.amount) ?? 0
        let closed = PeraBackend.decimal(item.close_amount) ?? derivedCloseAmount(item, account)
        // The sender pays both legs; the close target only receives what is addressed to it.
        let value: Decimal
        if isOut {
            value = paid + (closed ?? 0)
        } else if let closeTo = item.close_to, closeTo == account {
            value = item.receiver == account ? paid + (closed ?? 0) : (closed ?? 0)
        } else {
            value = paid
        }
        // Base units on the wire.
        let units = value / pow(10, facts.decimals)
        let amount = "\(PriceFormat.units(units, locale: locale)) \(facts.unitName)".trimmingCharacters(in: .whitespaces)
        return TransactionRow(id: item.id, kind: isOut ? .send : .receive, amount: amount, date: date)
    }

    // A clawback authority moving a holding to a third party loses nothing, but "Send" is its closest label.
    private static func isOutgoing(_ item: Item, _ account: String, debited: String?) -> Bool {
        debited == account || (item.sender == account && item.receiver != account)
    }

    // The backend sends no `asnd`: a negative impact on an asset transfer this account didn't send is a clawback.
    private static func derivedClawback(_ item: Item, _ account: String) -> String? {
        guard item.sender != account else { return nil }
        let assetId = item.asset?.asset_id?.stringValue
        guard let impact = item.impacts.first(where: { $0.asset_id?.stringValue == assetId }),
              let amount = PeraBackend.decimal(impact.amount)
        else { return nil }
        return amount < 0 ? account : nil
    }

    // The backend sends no `close_amount`; the account's balance impact holds the sweep exactly (the sender's
    // nets amount + close, plus the fee on ALGO). A non-positive result means an unexpected shape: no guess.
    private static func derivedCloseAmount(_ item: Item, _ account: String) -> Decimal? {
        guard item.close_to != nil else { return nil }
        let isPay = item.tx_type == "pay"
        let key = isPay ? PriceFetcher.nativeAssetId : item.asset?.asset_id?.stringValue
        guard let impact = item.impacts.first(where: { $0.asset_id?.stringValue == key }),
              let impactAmount = PeraBackend.decimal(impact.amount)
        else { return nil }
        let paid = PeraBackend.decimal(item.amount) ?? 0
        let closed: Decimal
        if account == item.sender {
            let fee = isPay ? (PeraBackend.decimal(item.fee) ?? 0) : 0
            closed = -impactAmount - paid - fee
        } else if account == item.close_to {
            closed = impactAmount - (item.receiver == account ? paid : 0)
        } else {
            return nil
        }
        return closed > 0 ? closed : nil
    }

    // An unknown asset keeps the backend's decimals, defaulting to 0, as the app's transformer does.
    private static func facts(_ asset: Asset?) -> Facts {
        if asset?.asset_id?.stringValue == PriceFetcher.nativeAssetId { return algo }
        let decimals = PeraBackend.decimal(asset?.fraction_decimals).map { NSDecimalNumber(decimal: $0).intValue } ?? 0
        return Facts(unitName: asset?.unit_name ?? "", decimals: decimals)
    }

    private struct Page: Decodable {
        let results: [Lossy<Item>]
    }

    private struct Item: Decodable {
        let id: String
        let tx_type: String
        let round_time: FlexibleNumber
        let sender: String?
        let receiver: String?
        let close_to: String?
        let asset_sender: String?
        /// Base units.
        let amount: FlexibleNumber?
        /// Base units.
        let close_amount: FlexibleNumber?
        /// microAlgos.
        let fee: FlexibleNumber?
        let asset: Asset?
        let swap_group_detail: Swap?
        let balance_impacts: [Impact]?

        var roundTime: TimeInterval { PeraBackend.decimal(round_time).map { NSDecimalNumber(decimal: $0).doubleValue } ?? 0 }
        var impacts: [Impact] { balance_impacts ?? [] }
    }

    private struct Asset: Decodable {
        let asset_id: FlexibleNumber?
        let unit_name: String?
        let fraction_decimals: FlexibleNumber?
    }

    private struct Swap: Decodable {
        let asset_in: Asset?
        let asset_out: Asset?
    }

    private struct Impact: Decodable {
        let asset_id: FlexibleNumber?
        /// Signed base units: negative = debited.
        let amount: FlexibleNumber?
    }
}
