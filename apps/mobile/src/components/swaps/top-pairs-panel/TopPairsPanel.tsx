import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { FlatList } from 'react-native';
import { Text } from '@rneui/themed';
import { useCallback } from 'react';

import SwapPair from '../swap-pair/SwapPair';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';
import { useV1AssetsList } from '@perawallet/core';

const TopPairsPanel = () => {
  const themeStyle = useStyles();
    
    //TODO: pull from server using asset IDs in a single query
    const { data: algoAssets } = useV1AssetsList({
      params: {
          q: 'algo'
      }
    })
  
    const { data: usdcAssets } = useV1AssetsList({
      params: {
          q: 'usdc'
      }
    })
  
    const { data: vestAssets } = useV1AssetsList({
      params: {
          q: 'vest'
      }
    })
    
    const algoAsset = algoAssets?.results?.length ? algoAssets.results.at(0) : null
    const usdcAsset = usdcAssets?.results?.length ? usdcAssets.results.at(0) : null
    const vestAsset = vestAssets?.results?.length ? vestAssets.results.at(0) : null

  const renderSwapPair = useCallback(
    ({ item }: { item: any }) => {
      return (
        <PeraView style={themeStyle.itemRow}>
          <SwapPair
            style={themeStyle.itemContainer}
            fromAsset={item.fromAsset}
            toAsset={item.toAsset}
          />
          <CurrencyDisplay
            currency="USD"
            precision={2}
            value={item.volume}
            units="K"
            h4
            h4Style={themeStyle.headerText}
          />
        </PeraView>
      );
    },
    [themeStyle],
  );

  //TODO: pull from server
  //TOOD make a thing that can render an asset label and an asset icon from the asset
  const pairs = [
    {
      fromAsset: vestAsset,
      toAsset: algoAsset,
      volume: 20000,
    },
    {
      fromAsset: algoAsset,
      toAsset: usdcAsset,
      volume: 234240,
    },
    {
      fromAsset: algoAsset,
      toAsset: vestAsset,
      volume: 422210,
    },
  ];

  return (
    <PeraView style={themeStyle.container}>
      <PeraView style={themeStyle.headerContainer}>
        <Text h4>Top 5 Swaps</Text>
        <Text h4 h4Style={themeStyle.headerText}>
          Volume (24H)
        </Text>
      </PeraView>
      <FlatList
        style={themeStyle.scrollContainer}
        contentContainerStyle={themeStyle.itemScrollContainer}
        data={pairs}
        renderItem={renderSwapPair}
      />
    </PeraView>
  );
};

export default TopPairsPanel;
