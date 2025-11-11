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

import React from 'react'
import {
  SwapContainer,
  Header,
  SwapCard,
  Section,
  Label,
  AssetInput,
  AssetInfo,
  AssetIcon,
  AssetDetails,
  AmountInput,
  SwapButtonContainer,
  SwapIconButton,
  SwapDetails,
  DetailRow,
  ExecuteSwapButton
} from './SwapScreen.styles'

const SwapScreen = (): React.ReactElement => {
  return (
    <SwapContainer>
      <Header>
        <h1>Swap</h1>
        <p>Exchange your assets instantly</p>
      </Header>

      <SwapCard>
        {/* From Section */}
        <Section>
          <Label>From</Label>
          <AssetInput>
            <AssetInfo>
              <AssetIcon>₳</AssetIcon>
              <AssetDetails>
                <div className="asset-name">ALGO</div>
                <div className="asset-symbol">Algorand</div>
              </AssetDetails>
            </AssetInfo>
            <AmountInput type="number" placeholder="0.00" />
          </AssetInput>
        </Section>

        {/* Swap Button */}
        <SwapButtonContainer>
          <SwapIconButton>⇅</SwapIconButton>
        </SwapButtonContainer>

        {/* To Section */}
        <Section>
          <Label>To</Label>
          <AssetInput>
            <AssetInfo>
              <AssetIcon>◈</AssetIcon>
              <AssetDetails>
                <div className="asset-name">USDC</div>
                <div className="asset-symbol">USD Coin</div>
              </AssetDetails>
            </AssetInfo>
            <AmountInput type="number" placeholder="0.00" readOnly />
          </AssetInput>
        </Section>

        {/* Swap Details */}
        <SwapDetails>
          <DetailRow>
            <span className="label">Exchange Rate</span>
            <span className="value">1 ALGO ≈ 0.25 USDC</span>
          </DetailRow>
          <DetailRow>
            <span className="label">Network Fee</span>
            <span className="value">0.001 ALGO</span>
          </DetailRow>
          <DetailRow>
            <span className="label">Slippage Tolerance</span>
            <span className="value">0.5%</span>
          </DetailRow>
        </SwapDetails>

        {/* Swap Button */}
        <ExecuteSwapButton>🔄 Swap Assets</ExecuteSwapButton>
      </SwapCard>
    </SwapContainer>
  )
}

export default SwapScreen
