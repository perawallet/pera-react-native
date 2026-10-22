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
import AppIntents
import WidgetKit

// Options shown in each widget's long-press "Edit Widget" sheet. Titles are
// keys in Localizable.xcstrings, so the sheet follows the device language.

enum ChartPeriodOption: String, AppEnum {
    case sameAsApp, oneDay, oneWeek, oneMonth, oneYear

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "options.chartPeriod"
    static let caseDisplayRepresentations: [ChartPeriodOption: DisplayRepresentation] = [
        .sameAsApp: "options.period.sameAsApp",
        .oneDay: "options.period.oneDay",
        .oneWeek: "options.period.oneWeek",
        .oneMonth: "options.period.oneMonth",
        .oneYear: "options.period.oneYear",
    ]

    /// The backend's period value; "Default" uses the app's chart period.
    func apiValue(appPeriod: String?) -> String {
        switch self {
        case .sameAsApp: appPeriod ?? "one-week"
        case .oneDay: "one-day"
        case .oneWeek: "one-week"
        case .oneMonth: "one-month"
        case .oneYear: "one-year"
        }
    }
}

enum RotationOption: String, AppEnum {
    // Declaration order is the sheet's order.
    case never, oneHour, sixHours, oneDay

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "options.rotation"
    static let caseDisplayRepresentations: [RotationOption: DisplayRepresentation] = [
        .never: "options.rotation.never",
        .oneHour: "options.rotation.oneHour",
        .sixHours: "options.rotation.sixHours",
        .oneDay: "options.rotation.oneDay",
    ]

    /// Nil for "Never": the NFT stays until the app next shares its NFTs.
    var interval: TimeInterval? {
        switch self {
        case .never: nil
        case .oneHour: 60 * 60
        case .sixHours: 6 * 60 * 60
        case .oneDay: 24 * 60 * 60
        }
    }
}

/// "Portfolio" (every account), then each of the user's accounts as the app
/// last shared them. `id` is the address, or `allId`.
struct AccountEntity: AppEntity {
    let id: String
    /// Nil for "Portfolio", whose label comes from the catalog.
    let name: String?

    static let allId = "all"
    static let all = AccountEntity(id: allId, name: nil)
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "options.account"
    static let defaultQuery = AccountQuery()

    var displayRepresentation: DisplayRepresentation {
        name.map { DisplayRepresentation(title: "\($0)") } ?? DisplayRepresentation(title: "options.portfolio")
    }

    /// Nil for every account.
    var address: String? { id == Self.allId ? nil : id }
}

struct AccountQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [AccountEntity] {
        all().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [AccountEntity] { all() }

    func defaultResult() async -> AccountEntity? { .all }

    // Only "Portfolio" in privacy mode: the app shares no accounts then.
    private func all() -> [AccountEntity] {
        [.all] + (WidgetSnapshot.current?.portfolioFeed?.accounts ?? []).map {
            AccountEntity(id: $0.address, name: $0.name)
        }
    }
}

/// An account the Receive QR widget can show. `id` is the address.
struct ReceiveAccountEntity: AppEntity {
    let id: String
    let name: String

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "options.account"
    static let defaultQuery = ReceiveAccountQuery()

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct ReceiveAccountQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [ReceiveAccountEntity] {
        all().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [ReceiveAccountEntity] { all() }

    func defaultResult() async -> ReceiveAccountEntity? { all().first }

    // Every account that can receive, watch accounts included; empty in privacy mode.
    private func all() -> [ReceiveAccountEntity] {
        (WidgetSnapshot.current?.receiveTargets ?? []).map {
            ReceiveAccountEntity(id: $0.address, name: $0.name)
        }
    }
}

/// "Random NFT", then each NFT whose image the app has cached. `id` is the
/// asset id, or `randomId`, which matches no asset.
struct NftEntity: AppEntity {
    let id: String
    /// Nil for "Random NFT", whose label comes from the catalog.
    let title: String?

    static let randomId = "random"
    static let random = NftEntity(id: randomId, title: nil)
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "options.nft"
    static let defaultQuery = NftQuery()

    var displayRepresentation: DisplayRepresentation {
        title.map { DisplayRepresentation(title: "\($0)") } ?? DisplayRepresentation(title: "options.nftRandom")
    }
}

struct NftQuery: EntityQuery {
    /// Ids an earlier build saved with a widget's configuration, and what they are now.
    private static let renamedIds = ["rotate": NftEntity.randomId]

    func entities(for identifiers: [String]) async throws -> [NftEntity] {
        let wanted = identifiers.map { Self.renamedIds[$0] ?? $0 }
        return all().filter { wanted.contains($0.id) }
    }

    func suggestedEntities() async throws -> [NftEntity] { all() }

    func defaultResult() async -> NftEntity? { .random }

    private func all() -> [NftEntity] {
        [.random] + (WidgetSnapshot.current?.nfts?.items ?? []).map { NftEntity(id: $0.assetId, title: $0.title) }
    }
}

/// ALGO plus the verified assets the app shares. `id` is the asset id.
struct AssetEntity: AppEntity {
    let id: String
    let unitName: String
    let name: String

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "options.asset"
    static let defaultQuery = AssetQuery()
    static let algo = AssetEntity(id: PriceFetcher.nativeAssetId, unitName: "ALGO", name: "Algorand")

    // The asset id is part of the label so look-alike names stay distinguishable.
    var displayRepresentation: DisplayRepresentation {
        id == PriceFetcher.nativeAssetId
            ? DisplayRepresentation(title: "\(unitName)", subtitle: "\(name)")
            : DisplayRepresentation(title: "\(unitName)", subtitle: "\(name) · ID \(id)")
    }
}

struct AssetQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [AssetEntity] {
        all().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [AssetEntity] { all() }

    func defaultResult() async -> AssetEntity? { .algo }

    private func all() -> [AssetEntity] {
        [.algo] + (WidgetSnapshot.current?.assetOptions ?? []).map {
            AssetEntity(id: $0.assetId, unitName: $0.unitName, name: $0.name)
        }
    }
}

/// A quote currency: ALGO, or a fiat currency from the backend list. `id` is its code.
struct CurrencyEntity: AppEntity {
    let id: String
    /// Nil for "Default", the app's currency, whose label comes from the catalog.
    let name: String?

    static let defaultId = "default"
    static let appDefault = CurrencyEntity(id: defaultId, name: nil)
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "options.currency"
    static let defaultQuery = CurrencyQuery()

    var displayRepresentation: DisplayRepresentation {
        name.map { DisplayRepresentation(title: "\(id)", subtitle: "\($0)") } ?? DisplayRepresentation(title: "options.default")
    }

    var isAppDefault: Bool { id == Self.defaultId }
}

struct CurrencyQuery: EntityQuery {
    private struct CurrencyItem: Decodable {
        let currency_id: String
        let name: String
    }

    func entities(for identifiers: [String]) async throws -> [CurrencyEntity] {
        await all().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [CurrencyEntity] { await all() }

    func defaultResult() async -> CurrencyEntity? { .appDefault }

    // Loaded live so the list matches the app's currency picker. On failure the
    // sheet still offers ALGO and USD.
    private func all() async -> [CurrencyEntity] {
        let fallback = [CurrencyEntity(id: "ALGO", name: "Algorand"), CurrencyEntity(id: "USD", name: "US Dollar")]
        guard let feed = WidgetSnapshot.current?.priceFeed, let base = URL(string: feed.backendUrl) else {
            return [.appDefault] + fallback
        }
        let list: [CurrencyItem]? = await PriceFetcher.get(base, "v1/currencies/", feed)
        guard let list, !list.isEmpty else { return [.appDefault] + fallback }
        return [.appDefault, fallback[0]] + list
            .filter { $0.currency_id != "ALGO" }
            .map { CurrencyEntity(id: $0.currency_id, name: $0.name) }
    }
}

struct PortfolioConfigIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "portfolio.name"

    @Parameter(title: "options.chartPeriod", default: .sameAsApp)
    var period: ChartPeriodOption

    @Parameter(title: "options.showChart", default: true)
    var showChart: Bool

    /// Unset or "Portfolio" means every account.
    @Parameter(title: "options.account")
    var account: AccountEntity?

    init() {}
}

struct PriceConfigIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "price.name"

    /// Unset means ALGO.
    @Parameter(title: "options.asset")
    var asset: AssetEntity?

    /// Unset or "Default" means the app's currency.
    @Parameter(title: "options.currency")
    var currency: CurrencyEntity?

    @Parameter(title: "options.chartPeriod", default: .oneWeek)
    var period: ChartPeriodOption

    @Parameter(title: "options.showInverse", default: true)
    var showInverse: Bool

    init() {}
}

struct NftConfigIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "nft.name"

    /// Unset or "Random NFT" picks one at random, and another every "Change every".
    @Parameter(title: "options.nft")
    var nft: NftEntity?

    @Parameter(title: "options.rotation", default: .never)
    var rotation: RotationOption

    init() {}
}

struct TransactionsConfigIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "transactions.name"

    /// Unset or "Portfolio" means every account.
    @Parameter(title: "options.account")
    var account: AccountEntity?

    init() {}
}

struct ReceiveConfigIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "receive.name"

    /// Unset means the first account.
    @Parameter(title: "options.account")
    var account: ReceiveAccountEntity?

    init() {}
}

/// Which page the Portfolio widget shows: 0 = portfolio, 1 = recent transactions.
/// Kept in the App Group because a widget button's intent can't reach the
/// timeline any other way; it is shared by every Portfolio widget on screen.
enum PortfolioPageStore {
    static var page: Int {
        get { WidgetPageStore.page(WidgetPageStore.portfolioButton) }
        set { WidgetPageStore.set(newValue, WidgetPageStore.portfolioButton) }
    }
}

/// The page-flip button on the Portfolio widget. WidgetKit reloads the widget
/// after it runs, and the provider then reads the new page.
struct FlipPortfolioPageIntent: AppIntent {
    static let title: LocalizedStringResource = "options.flipPage"

    func perform() async throws -> some IntentResult {
        PortfolioPageStore.page = PortfolioPageStore.page == 0 ? 1 : 0
        return .result()
    }
}
