import {Platform, View} from 'react-native';
import type {ViewStyle} from 'react-native';
import {requireNativeComponent} from 'react-native';

type SymbolWeight =
  | 'ultraLight'
  | 'thin'
  | 'light'
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'heavy'
  | 'black';

type SymbolScale = 'small' | 'medium' | 'large';

type NativeProps = {
  name: string;
  pointSize?: number;
  weight?: SymbolWeight;
  scale?: SymbolScale;
  colorHex?: string;
  style?: ViewStyle;
};

const NativeSFSymbolView =
  Platform.OS === 'ios'
    ? requireNativeComponent<NativeProps>('SFSymbolView')
    : null;

export function SFSymbol({
  colorHex,
  name,
  pointSize = 16,
  scale = 'medium',
  style,
  weight = 'regular',
}: NativeProps) {
  if (!NativeSFSymbolView) {
    return <View style={style} />;
  }

  return (
    <NativeSFSymbolView
      colorHex={colorHex}
      name={name}
      pointSize={pointSize}
      scale={scale}
      style={style}
      weight={weight}
    />
  );
}
