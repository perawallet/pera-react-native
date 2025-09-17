import '@rneui/themed';

declare module '@rneui/themed' {
  export interface Colors {
    //Layer colors
    layerGray: string;
    layerGrayLight: string;
    layerGrayLighter: string;
    layerGrayLightest: string;

    //Text colors
    textGray: string;
    textGrayLighter: string;
    textMain: string;
    textSonicSilver: string;
    textWhite: string;

    //Button colos
    buttonPrimaryBg: string;
    buttonPrimaryText: string;
  }
}
