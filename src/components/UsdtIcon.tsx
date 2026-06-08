import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface UsdtIconProps {
  size?: number;
  color?: string;
}

/** Ícono de USDT (Tether ₮). Portado de src/components/UsdtIcon.js del repo original. */
export function UsdtIcon({ size = 18, color = '#FF9500' }: UsdtIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <Path
        d="M75.0006 49.7803V37.2703H103.461V17.5303H24.4606V37.2703H53.0006V49.7803C29.0906 50.9303 11.1406 55.7303 11.1406 61.4803C11.1406 67.2303 29.0706 72.0003 53.0006 73.1803V114.47H75.0006V73.1803C98.9106 72.0403 116.861 67.2403 116.861 61.4803C116.861 55.7203 98.9306 50.9303 75.0006 49.7803ZM64.0006 69.4403C38.1106 69.4403 17.1206 65.4403 17.1206 60.6203C17.1206 56.4703 32.4106 52.9903 52.9806 52.0603V66.1903C56.5206 66.3503 60.2006 66.4403 63.9806 66.4403C67.7606 66.4403 71.4606 66.3503 74.9806 66.1903V52.0603C95.5506 52.9903 110.841 56.4703 110.841 60.6203C110.881 65.4903 89.8906 69.4403 64.0006 69.4403Z"
        fill={color}
      />
    </Svg>
  );
}

export default UsdtIcon;
