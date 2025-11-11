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

import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { useCallback } from 'react';

import SwapPair from '../swap-pair/SwapPair';
import { AssetDetails, useCachedAssets } from '@perawallet/core';

const SwapHistoryPanel = () => {
  const themeStyle = useStyles();

  const { assets } = useCachedAssets([11711, 10458941, 700965019]);

  const algoAsset = assets?.length
    ? assets.find((a: AssetDetails) => a.unit_name === 'ALGO')
    : null;
  const usdcAsset = assets?.length
    ? assets.find((a: AssetDetails) => a.unit_name === 'USDC')
    : null;
  const vestAsset = assets?.length
    ? assets.find((a: AssetDetails) => a.unit_name === 'HIPO')
    : null;

  const renderSwapPair = useCallback(
    (item: any, index: number) => {
      return (
        <SwapPair
          key={'swappair' + index}
          style={themeStyle.itemContainer}
          fromAsset={item.fromAsset}
          toAsset={item.toAsset}
        />
      );
    },
    [themeStyle.itemContainer],
  );

  const pairs = [
    {
      fromAsset: vestAsset,
      toAsset: algoAsset,
    },
    {
      fromAsset: algoAsset,
      toAsset: usdcAsset,
    },
    {
      fromAsset: algoAsset,
      toAsset: vestAsset,
    },
  ];

  return (
    <PeraView style={themeStyle.container}>
      <PeraView style={themeStyle.headerContainer}>
        <Text h4>Swap History</Text>
        <TouchableOpacity>
          <Text h4 h4Style={themeStyle.headerText}>
            See all
          </Text>
        </TouchableOpacity>
      </PeraView>
      <ScrollView
        contentContainerStyle={themeStyle.itemScrollContainer}
        horizontal={true}
      >
        {pairs.map((item, i) => {
          return renderSwapPair(item, i);
        })}
      </ScrollView>
    </PeraView>
  );
};

export default SwapHistoryPanel;
