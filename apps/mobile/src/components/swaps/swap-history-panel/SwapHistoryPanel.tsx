import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { useCallback } from 'react';

import SwapPair from '../swap-pair/SwapPair';
import { useV1AssetsList } from '@perawallet/core';

const SwapHistoryPanel = () => {
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
