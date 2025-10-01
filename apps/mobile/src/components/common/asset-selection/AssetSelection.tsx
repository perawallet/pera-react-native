import { Text } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';

import ChevronRight from '../../../../assets/icons/chevron-right.svg';

export type AssetSelectionProps = {
  name: string;
  icon: React.ReactElement<{}>;
};

const AssetSelection = ({ name, icon }: AssetSelectionProps) => {
  const styles = useStyles();

  return (
    <PeraView style={styles.container}>
      {icon}
      <Text h4Style={styles.text} h4>
        {name}
      </Text>
      <ChevronRight />
    </PeraView>
  );
};

export default AssetSelection;
