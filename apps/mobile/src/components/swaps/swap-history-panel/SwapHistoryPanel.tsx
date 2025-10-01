import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { useCallback } from 'react';

// TODO: these should be loaded from the server
import AlgoAssetIcon from '../../../../assets/icons/assets/algo.svg';
import VestAssetIcon from '../../../../assets/icons/assets/vest.svg';
import USDCAssetIcon from '../../../../assets/icons/assets/usdc.svg';
import SwapPair from '../swap-pair/SwapPair';

const SwapHistoryPanel = () => {
  const themeStyle = useStyles();

  const renderSwapPair = useCallback((item: any, index: number) => {
    return (
      <SwapPair
        key={'swappair' + index}
        style={themeStyle.itemContainer}
        fromName={item.fromName}
        fromIcon={item.fromIcon}
        toIcon={item.toIcon}
        toName={item.toName}
      />
    );
  }, []);

  //TODO: pull from server
  //TOOD make a thing that can render an asset label and an asset icon from the asset
  const pairs = [
    {
      fromName: 'VEST',
      fromIcon: <VestAssetIcon style={themeStyle.fromIcon} />,
      toName: 'ALGO',
      toIcon: <AlgoAssetIcon style={themeStyle.toIcon} />,
    },
    {
      fromName: 'ALGO',
      fromIcon: <AlgoAssetIcon style={themeStyle.fromIcon} />,
      toName: 'USDC',
      toIcon: <USDCAssetIcon style={themeStyle.toIcon} />,
    },
    {
      fromName: 'ALGO',
      fromIcon: <AlgoAssetIcon style={themeStyle.fromIcon} />,
      toName: 'VEST',
      toIcon: <VestAssetIcon style={themeStyle.toIcon} />,
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
