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
        strings: ["updated": "Updated", "algoPrice": "ALGO price", "portfolio": "Portfolio Value", "hidden": "Hidden", "nftsEmpty": "No NFTs yet"],
        algoPrice: .init(formatted: "$ 0.1923", asOf: Date.now.addingTimeInterval(-3600).timeIntervalSince1970 * 1000),
        portfolio: .init(state: "visible", formatted: "$ 1,234.56", algoFormatted: "6,500.12 ALGO", asOf: nil),
        nfts: .init(state: "visible", items: [.init(assetId: "286018494", title: "Algo Gif", collectionName: "Gifs", imageKey: "286018494")])
    )

    static let fixtureTestnetHidden = WidgetSnapshot(
        version: 1, locale: "pt-BR", theme: "dark",
        network: .init(isMainnet: false, label: "TestNet"),
        strings: ["updated": "Atualizado", "algoPrice": "Preço do ALGO", "portfolio": "Valor do portfólio", "hidden": "Oculto"],
        algoPrice: .init(formatted: "R$ 0,98", asOf: Date.now.timeIntervalSince1970 * 1000),
        portfolio: .init(state: "hidden", formatted: nil, algoFormatted: nil, asOf: nil),
        nfts: .init(state: "hidden", items: nil)
    )

    static let fixtureEmpty = WidgetSnapshot(
        version: 1, locale: "ar", theme: "light",
        network: .init(isMainnet: true, label: "MainNet"),
        strings: ["nftsEmpty": "No NFTs yet"],
        algoPrice: nil, portfolio: nil,
        nfts: .init(state: "visible", items: [])
    )
}
