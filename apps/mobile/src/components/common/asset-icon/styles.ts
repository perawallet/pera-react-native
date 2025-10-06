import { makeStyles } from '@rneui/themed';
import { AssetIconProps } from './AssetIcon';

export const useStyles = makeStyles((theme, props: AssetIconProps) => {
  return {
    icon: {
      borderRadius: 50,
      width: props.size || '100%',
      height: props.size || '100%',
    }
  };
});
