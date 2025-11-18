import { isIOS } from '../platform/utils';

export const fontFamilies = {
  DMSANS: {
    300: isIOS() ? 'DMSans-Light' : 'DMSansLight',
    400: isIOS() ? 'DMSans-Regular' : 'DMSansRegular',
    500: isIOS() ? 'DMSans-Medium' : 'DMSansMedium',
    600: isIOS() ? 'DMSans-SemiBold' : 'DMSansSemiBold',
    700: isIOS() ? 'DMSans-Bold' : 'DMSansBold'
  },
  DMMONO: {
    //We duplicate some here because we only use regular and medium
    300: isIOS() ? 'DMMono-Regular' : 'DMMonoRegular',
    400: isIOS() ? 'DMMono-Regular' : 'DMMonoRegular',
    500: isIOS() ? 'DMMono-Medium' : 'DMMonoRegular',
    600: isIOS() ? 'DMMono-Medium' : 'DMMonoRegular',
    700: isIOS() ? 'DMMono-Medium' : 'DMMonoRegular'
  }
};
