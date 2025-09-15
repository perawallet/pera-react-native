import MainScreenLayout from '../../layouts/MainScreenLayout';
import PeraView from '../../components/view/PeraView';
import { Text } from '@rneui/themed';

const MenuScreen = () => {
  return (
    <MainScreenLayout>
      <PeraView>
        <Text>This will be the menu screen</Text>
      </PeraView>
    </MainScreenLayout>
  );
};

export default MenuScreen;
