import { BottomSheet, BottomSheetProps } from '@rneui/themed';
import PeraView, { PeraViewProps } from '../view/PeraView';
import { PropsWithChildren } from 'react';
import { useStyles } from './styles';

type PeraBottomSheetProps = {
  innerContainerStyle?: PeraViewProps;
} & BottomSheetProps &
  PropsWithChildren;

const PeraBottomSheet = ({
  innerContainerStyle,
  children,
  ...rest
}: PeraBottomSheetProps) => {
  const style = useStyles();
  return (
    <BottomSheet {...rest}>
      <PeraView style={[style.defaultStyle, innerContainerStyle]}>
        {children}
      </PeraView>
    </BottomSheet>
  );
};

export default PeraBottomSheet;
