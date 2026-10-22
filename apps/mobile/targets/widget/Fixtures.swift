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

// Preview data only.
extension WidgetSnapshot {
    static let fixtureMainnet = WidgetSnapshot(
        version: 1, locale: "en", theme: "system",
        network: .init(isMainnet: true, label: "MainNet"),
        strings: [
            "updated": "Updated", "algoPrice": "ALGO price", "portfolio": "Portfolio Value", "hidden": "Hidden", "nftsEmpty": "No NFTs yet",
            "tabPortfolio": "Portfolio", "tabTransactions": "Transactions", "inbox": "Inbox", "notifications": "Notifications",
            "inboxEmpty": "All caught up", "notificationsEmpty": "No notifications yet", "waiting": "waiting", "toSign": "to sign",
            "inboxSign": "Signature request", "inboxAssets": "Incoming assets", "inboxInvite": "Shared account invitation",
            "cloudBackup": "Cloud Backup", "passphraseBackup": "Passphrase Backup", "notAvailable": "Not available",
        ],
        priceFeed: nil,
        portfolioFeed: nil,
        assetOptions: nil,
        algoPrice: .init(formatted: "$ 0.1923", asOf: Date.now.addingTimeInterval(-3600).timeIntervalSince1970 * 1000),
        portfolio: .init(state: "visible", formatted: "$ 1,234.56", algoFormatted: "6,500.12 ALGO", asOf: Date.now.addingTimeInterval(-600).timeIntervalSince1970 * 1000),
        nfts: .init(state: "visible", items: [.init(assetId: "286018494", title: "Algo Gif", collectionName: "Gifs", imageKey: "286018494")]),
        backup: .init(
            cloud: .init(state: "partial", title: "2 accounts not in backup", detail: "Tap to back up"),
            passphrase: .init(state: "needed", title: "1 account needs a backup", detail: "Tap to back up")
        ),
        receiveTargets: [
            .init(
                address: "CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA",
                name: "Main account",
                paymentUri: "algorand://CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA",
                chain: "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k"
            ),
        ],
        inboxFeed: .init(
            deviceId: "device",
            addresses: ["MAIN"],
            accountNames: [.init(address: "MAIN", name: "Main account"), .init(address: "VAULT", name: "Team Vault")],
            notifications: .init(backendUrl: "https://example.invalid", deviceId: "device")
        )
    )

    static let fixtureTestnetHidden = WidgetSnapshot(
        version: 1, locale: "pt-BR", theme: "dark",
        network: .init(isMainnet: false, label: "TestNet"),
        strings: [
            "updated": "Atualizado", "algoPrice": "Preço do ALGO", "portfolio": "Valor do portfólio", "hidden": "Oculto",
            "cloudBackup": "Backup na nuvem", "passphraseBackup": "Passphrase de recuperação",
        ],
        priceFeed: nil,
        portfolioFeed: nil,
        assetOptions: nil,
        algoPrice: .init(formatted: "R$ 0,98", asOf: Date.now.timeIntervalSince1970 * 1000),
        portfolio: .init(state: "hidden", formatted: nil, algoFormatted: nil, asOf: nil),
        nfts: .init(state: "hidden", items: nil),
        backup: .init(
            cloud: .init(state: "backedUp", title: "Backup feito", detail: "Última sincronização: 16/10/2026 10:22"),
            passphrase: .init(state: "backedUp", title: "Tudo com backup", detail: nil)
        ),
        receiveTargets: nil,
        inboxFeed: nil
    )

    static let fixtureEmpty = WidgetSnapshot(
        version: 1, locale: "ar", theme: "light",
        network: .init(isMainnet: true, label: "MainNet"),
        strings: ["nftsEmpty": "No NFTs yet"],
        priceFeed: nil,
        portfolioFeed: nil,
        assetOptions: nil,
        algoPrice: nil, portfolio: nil,
        nfts: .init(state: "visible", items: []),
        backup: nil,
        receiveTargets: nil,
        inboxFeed: nil
    )
}

extension PriceQuote {
    static func fixture(change: Double, quote: QuoteCurrency = .fiat("USD")) -> PriceQuote {
        PriceQuote(
            assetId: "0",
            unitName: "ALGO",
            price: Decimal(string: "0.1923")!,
            change24h: change,
            chart: [0.181, 0.184, 0.179, 0.186, 0.19, 0.188, 0.1923],
            quote: quote,
            fetchedAt: .now.addingTimeInterval(-300)
        )
    }

    static let fixtureUsdc = PriceQuote(
        assetId: "31566704",
        unitName: "USDC",
        price: Decimal(string: "5.2")!,
        change24h: 0.012,
        chart: [5.0, 5.1, 5.05, 5.2],
        quote: .algo,
        fetchedAt: .now.addingTimeInterval(-60)
    )
}

extension PortfolioQuote {
    static func fixture(change: Double) -> PortfolioQuote {
        PortfolioQuote(
            algo: Decimal(string: "6500.12")!,
            fiat: Decimal(string: "1234.56")!,
            currencyCode: "USD",
            chart: [6200, 6310, 6280, 6400, 6390, 6450, 6500.12],
            change: change,
            fetchedAt: .now.addingTimeInterval(-300)
        )
    }
}

extension WidgetSnapshot {
    static let fixtureWithFeeds = WidgetSnapshot(
        version: 1, locale: "en", theme: "system",
        network: .init(isMainnet: true, label: "MainNet"),
        strings: [
            "updated": "Updated", "portfolio": "Portfolio Value", "recentTransactions": "Last transactions",
            "noTransactions": "No transactions available", "transaction": "Transaction", "txSend": "Send",
            "txReceive": "Receive", "txSwap": "Swap", "txOptIn": "Opt-in", "txOptOut": "Opt-out", "txAppCall": "App Call",
            "tabPortfolio": "Portfolio", "tabTransactions": "Transactions",
        ],
        priceFeed: .init(backendUrl: "https://example.invalid", apiKey: "", currencyCode: "USD"),
        portfolioFeed: .init(accounts: [.init(address: "ADDR", name: "Main")], period: "one-week"),
        assetOptions: [.init(assetId: "31566704", name: "USDC", unitName: "USDC")],
        algoPrice: .init(formatted: "$ 0.1923", asOf: Date.now.timeIntervalSince1970 * 1000),
        portfolio: .init(state: "visible", formatted: "$ 1,234.56", algoFormatted: "6,500.12 ALGO", asOf: Date.now.timeIntervalSince1970 * 1000),
        nfts: nil,
        backup: nil,
        receiveTargets: nil,
        inboxFeed: nil
    )
}

extension TransactionRow {
    static let fixtures: [TransactionRow] = [
        .init(id: "1", kind: .receive, amount: "250 USDC", date: .now.addingTimeInterval(-600)),
        .init(id: "2", kind: .send, amount: "25 ALGO", date: .now.addingTimeInterval(-7200)),
        .init(id: "3", kind: .swap, amount: "USDC → ALGO", date: .now.addingTimeInterval(-86_400)),
        .init(id: "4", kind: .optIn, amount: nil, date: .now.addingTimeInterval(-172_800)),
        .init(id: "5", kind: .appCall, amount: nil, date: .now.addingTimeInterval(-259_200)),
    ]
}
