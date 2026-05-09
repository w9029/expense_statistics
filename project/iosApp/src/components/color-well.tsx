import {Platform, View, requireNativeComponent} from 'react-native';
import type {ViewStyle} from 'react-native';

type NativeProps = {
  colorHex?: string;
  style?: ViewStyle;
  onColorChange?: (event: {nativeEvent: {colorHex: string}}) => void;
};

const NativeColorWellView =
  Platform.OS === 'ios'
    ? requireNativeComponent<NativeProps>('ColorWellView')
    : null;

export function ColorWell({
  colorHex,
  onColorChange,
  style,
}: NativeProps) {
  if (!NativeColorWellView) {
    return <View style={style} />;
  }

  return (
    <NativeColorWellView
      colorHex={colorHex}
      onColorChange={onColorChange}
      style={style}
    />
  );
}
