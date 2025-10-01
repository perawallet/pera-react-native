import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { FlatList, ScrollView } from 'react-native';
import { Text } from '@rneui/themed';
import { useCallback } from 'react';

// TODO: these should be loaded from the server
import AlgoAssetIcon from '../../../../assets/icons/assets/algo.svg';
import VestAssetIcon from '../../../../assets/icons/assets/vest.svg';
import USDCAssetIcon from '../../../../assets/icons/assets/usdc.svg';
import SwapPair from '../swap-pair/SwapPair';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';

const TopPairsPanel = () => {
  const themeStyle = useStyles();

  const renderSwapPair = useCallback(({ item }: { item: any}) => {
    return (
      <PeraView style={themeStyle.itemRow}>
        <SwapPair
          style={themeStyle.itemContainer}
          fromName={item.fromName}
          fromIcon={item.fromIcon}
          toIcon={item.toIcon}
          toName={item.toName}
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
  }, []);

  //TODO: pull from server
  //TOOD make a thing that can render an asset label and an asset icon from the asset
  const pairs = [
    {
      fromName: 'VEST',
      fromIcon: <VestAssetIcon style={themeStyle.fromIcon} />,
      toName: 'ALGO',
      toIcon: <AlgoAssetIcon style={themeStyle.toIcon} />,
      volume: 20000,
    },
    {
      fromName: 'ALGO',
      fromIcon: <AlgoAssetIcon style={themeStyle.fromIcon} />,
      toName: 'USDC',
      toIcon: <USDCAssetIcon style={themeStyle.toIcon} />,
      volume: 234240,
    },
    {
      fromName: 'ALGO',
      fromIcon: <AlgoAssetIcon style={themeStyle.fromIcon} />,
      toName: 'VEST',
      toIcon: <VestAssetIcon style={themeStyle.toIcon} />,
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
      <FlatList style={themeStyle.scrollContainer} contentContainerStyle={themeStyle.itemScrollContainer} data={pairs} renderItem={renderSwapPair} />
    </PeraView>
  );
};

export default TopPairsPanel;
