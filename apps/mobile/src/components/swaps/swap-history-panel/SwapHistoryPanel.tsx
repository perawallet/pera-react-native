import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { useCallback } from 'react';

import SwapPair from '../swap-pair/SwapPair';

const SwapHistoryPanel = () => {
  const themeStyle = useStyles();

  const renderSwapPair = useCallback((item: any, index: number) => {
    return (
      <SwapPair
        key={'swappair' + index}
        style={themeStyle.itemContainer}
        fromName={item.fromName}
        toName={item.toName}
      />
    );
  }, []);

  //TODO: pull from server
  //TOOD make a thing that can render an asset label and an asset icon from the asset
  const pairs = [
    {
      fromName: 'VEST',
      toName: 'ALGO',
    },
    {
      fromName: 'ALGO',
      toName: 'USDC',
    },
    {
      fromName: 'ALGO',
      toName: 'VEST',
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
