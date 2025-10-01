import { Text } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';

import ChevronRight from '../../../../assets/icons/chevron-right.svg';
import AssetIcon from '../asset-icon/AssetIcon';

export type AssetSelectionProps = {
  name: string;
};

const AssetSelection = ({ name }: AssetSelectionProps) => {
  const styles = useStyles();

  return (
    <PeraView style={styles.container}>
      <AssetIcon asset={name} />
      <Text h4Style={styles.text} h4>
        {name}
      </Text>
      <ChevronRight />
    </PeraView>
  );
};

export default AssetSelection;
