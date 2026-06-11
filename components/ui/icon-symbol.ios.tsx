import { Text, type OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

const MAPPING = {
  "house.fill": "Home",
  "paperplane.fill": ">",
  "chevron.left.forwardslash.chevron.right": "</>",
  "chevron.right": ">",
} as const;

type IconSymbolName = keyof typeof MAPPING;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: unknown;
}) {
  return (
    <Text
      style={[
        {
          color,
          fontSize: Math.max(12, Math.round(size * 0.55)),
          fontWeight: "700",
          lineHeight: size,
          minWidth: size,
          height: size,
          textAlign: "center",
        },
        style,
      ]}
    >
      {MAPPING[name]}
    </Text>
  );
}
