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
    /// Formatted amount with unit ("25.00 ALGO", "USDC → ALGO"); nil when the
    /// transaction moves nothing worth showing (opt-ins, plain app calls).
    let amount: String?
    let date: Date
}

enum TransactionsFetcher {
    // One request per account; capping keeps "Portfolio" (every account) inside WidgetKit's
    // few-second budget on wallets with many accounts.
    private static let maxAccounts = 5

    /// Newest first across `addresses`, at most `limit` rows; nil when every request failed.
    static func fetch(
        addresses: [String],
        limit: Int,
        locale: Locale,
        _ feed: WidgetSnapshot.PriceFeed
    ) async -> [TransactionRow]? {
        guard let base = URL(string: feed.backendUrl) else { return nil }
        let accounts = Array(addresses.prefix(maxAccounts))

        let pages = await withTaskGroup(of: Page?.self) { group in
            for address in accounts {
                group.addTask {
                    await PriceFetcher.get(base, "v1/accounts/\(address)/transactions/?limit=\(limit)", feed)
                }
            }
            var results: [Page?] = []
            for await page in group { results.append(page) }
            return results
        }
        let loaded = pages.compactMap { $0 }
        guard !loaded.isEmpty else { return nil }

        // A transfer between two of the user's accounts appears in both histories.
        var seen = Set<String>()
        return loaded
            .flatMap(\.results)
            .sorted { $0.roundTime > $1.roundTime }
            .filter { seen.insert($0.id).inserted }
            .prefix(limit)
            .map { row($0, locale: locale) }
    }

    private static func row(_ item: Item, locale: Locale) -> TransactionRow {
        let date = Date(timeIntervalSince1970: item.roundTime)

        if let swap = item.swap_group_detail {
            let from = swap.asset_in?.unit_name ?? ""
            let to = swap.asset_out?.unit_name ?? ""
            let amount = from.isEmpty || to.isEmpty ? nil : "\(from) → \(to)"
            return TransactionRow(id: item.id, kind: .swap, amount: amount, date: date)
        }

        // The ALGO impact includes the fee, so another asset's movement is the
        // meaningful one when there is one.
        let impacts = (item.balance_impacts ?? []).filter { (PriceFetcher.decimal($0.amount) ?? 0) != 0 }
        let impact = impacts.first { $0.assetId != PriceFetcher.nativeAssetId } ?? impacts.first
        let isAssetMovement = impact.map { $0.assetId != PriceFetcher.nativeAssetId } ?? false

        switch item.tx_type {
        case "axfer" where item.close_to != nil && !isAssetMovement:
            return TransactionRow(id: item.id, kind: .optOut, amount: nil, date: date)
        case "axfer" where !isAssetMovement:
            return TransactionRow(id: item.id, kind: .optIn, amount: nil, date: date)
        case "appl" where !isAssetMovement:
            return TransactionRow(id: item.id, kind: .appCall, amount: nil, date: date)
        default:
            break
        }

        guard let impact, let value = PriceFetcher.decimal(impact.amount) else {
            return TransactionRow(id: item.id, kind: .other, amount: nil, date: date)
        }
        let units = abs(value) / pow(10, impact.fraction_decimals ?? 0)
        let unit = impact.unit_name?.isEmpty == false ? impact.unit_name! : (impact.assetId == PriceFetcher.nativeAssetId ? "ALGO" : "")
        let amount = "\(PriceFormat.decimal(units, maxDigits: 6, locale: locale)) \(unit)".trimmingCharacters(in: .whitespaces)
        return TransactionRow(id: item.id, kind: value < 0 ? .send : .receive, amount: amount, date: date)
    }

    private struct Page: Decodable {
        let results: [Item]
    }

    private struct Item: Decodable {
        let id: String
        let tx_type: String
        let round_time: PriceFetcher.FlexibleNumber
        let close_to: String?
        let swap_group_detail: Swap?
        let balance_impacts: [Impact]?

        var roundTime: TimeInterval { Double(round_time.stringValue) ?? 0 }
    }

    private struct Swap: Decodable {
        let asset_in: SwapSide?
        let asset_out: SwapSide?
    }

    private struct SwapSide: Decodable {
        let unit_name: String?
    }

    private struct Impact: Decodable {
        let asset_id: PriceFetcher.FlexibleNumber
        let unit_name: String?
        let fraction_decimals: Int?
        /// Signed base units: negative = sent.
        let amount: PriceFetcher.FlexibleNumber

        var assetId: String { asset_id.stringValue }
    }
}
