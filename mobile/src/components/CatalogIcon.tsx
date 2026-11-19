import { View, StyleSheet } from "react-native";
type IconName =
  | "search"
  | "close"
  | "play"
  | "home"
  | "user"
  | "heart"
  | "back"
  | "music"
  | "layers"
  | "disc"
  | "plus"
  | "calendar"
  | "check"
  | "edit"
  | "dots"
  | "up"
  | "down"
  | "menu"
  | "trash"
  | "clock"
  | "bell"
  | "compass";
export function CatalogIcon({
  name,
  size = 24,
  color = "#eadcf7",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessible={false}
    >
      <View
        style={{ width: 24, height: 24, transform: [{ scale: size / 24 }] }}
      >
        {name === "search" ? (
          <>
            <View style={[i.search, { borderColor: color }]} />
            <View style={[i.searchStem, { backgroundColor: color }]} />
          </>
        ) : name === "play" ? (
          <View style={[i.play, { borderLeftColor: color }]} />
        ) : name === "close" ? (
          <>
            <View
              style={[
                i.cross,
                { backgroundColor: color, transform: [{ rotate: "45deg" }] },
              ]}
            />
            <View
              style={[
                i.cross,
                { backgroundColor: color, transform: [{ rotate: "-45deg" }] },
              ]}
            />
          </>
        ) : name === "user" ? (
          <>
            <View style={[i.head, { borderColor: color }]} />
            <View style={[i.shoulders, { borderColor: color }]} />
          </>
        ) : name === "home" ? (
          <>
            <View style={[i.roof, { borderColor: color }]} />
            <View style={[i.house, { borderColor: color }]} />
          </>
        ) : name === "heart" ? (
          <>
            <View style={[i.heart, { borderColor: color }]} />
            <View style={[i.heartLeft, { borderColor: color }]} />
            <View style={[i.heartRight, { borderColor: color }]} />
          </>
        ) : name === "back" ? (
          <View style={[i.back, { borderColor: color }]} />
        ) : name === "plus" ? (
          <>
            <View style={[i.plusH, { backgroundColor: color }]} />
            <View style={[i.plusV, { backgroundColor: color }]} />
          </>
        ) : name === "check" ? (
          <View style={[i.check, { borderColor: color }]} />
        ) : name === "disc" ? (
          <>
            <View style={[i.discOuter, { borderColor: color }]} />
            <View style={[i.discInner, { backgroundColor: color }]} />
          </>
        ) : name === "layers" ? (
          <>
            <View style={[i.layer1, { borderColor: color }]} />
            <View style={[i.layer2, { borderColor: color }]} />
            <View style={[i.layer3, { borderColor: color }]} />
          </>
        ) : name === "calendar" ? (
          <>
            <View style={[i.calBody, { borderColor: color }]} />
            <View style={[i.calHeader, { backgroundColor: color }]} />
          </>
        ) : name === "dots" ? (
          <>
            <View style={[i.dot1, { backgroundColor: color }]} />
            <View style={[i.dot2, { backgroundColor: color }]} />
            <View style={[i.dot3, { backgroundColor: color }]} />
          </>
        ) : name === "menu" ? (
          <>
            <View style={[i.menuLine1, { backgroundColor: color }]} />
            <View style={[i.menuLine2, { backgroundColor: color }]} />
            <View style={[i.menuLine3, { backgroundColor: color }]} />
          </>
        ) : name === "up" ? (
          <View style={[i.arrowUp, { borderColor: color }]} />
        ) : name === "down" ? (
          <View style={[i.arrowDown, { borderColor: color }]} />
        ) : name === "trash" ? (
          <>
            <View style={[i.trashCan, { borderColor: color }]} />
            <View style={[i.trashLid, { backgroundColor: color }]} />
          </>
        ) : name === "edit" ? (
          <View style={[i.editPencil, { borderColor: color }]} />
        ) : name === "clock" ? (
          <>
            <View style={[i.clockOuter, { borderColor: color }]} />
            <View style={[i.clockHandV, { backgroundColor: color }]} />
            <View style={[i.clockHandH, { backgroundColor: color }]} />
          </>
        ) : name === "bell" ? (
          <>
            <View style={[i.bellBody, { borderColor: color }]} />
            <View style={[i.bellBottom, { backgroundColor: color }]} />
            <View style={[i.bellClapper, { backgroundColor: color }]} />
          </>
        ) : name === "compass" ? (
          <>
            <View style={[i.compassRing, { borderColor: color }]} />
            <View style={[i.compassNeedle, { backgroundColor: color }]} />
          </>
        ) : (
          <>
            <View style={[i.note, { borderColor: color }]} />
            <View style={[i.noteDot, { backgroundColor: color }]} />
          </>
        )}
      </View>
    </View>
  );
}
const i = StyleSheet.create({
  search: {
    position: "absolute",
    left: 2,
    top: 2,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.7,
  },
  searchStem: {
    position: "absolute",
    width: 9,
    height: 1.7,
    left: 15,
    top: 18,
    transform: [{ rotate: "45deg" }],
  },
  play: {
    position: "absolute",
    left: 9,
    top: 5,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  cross: { position: "absolute", left: 3, top: 11, width: 19, height: 1.8 },
  head: {
    position: "absolute",
    left: 8,
    top: 2,
    width: 9,
    height: 9,
    borderWidth: 1.7,
    borderRadius: 5,
  },
  shoulders: {
    position: "absolute",
    left: 4,
    top: 14,
    width: 17,
    height: 8,
    borderWidth: 1.7,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  roof: {
    position: "absolute",
    left: 5,
    top: 4,
    width: 14,
    height: 14,
    borderTopWidth: 1.7,
    borderLeftWidth: 1.7,
    transform: [{ rotate: "45deg" }],
  },
  house: {
    position: "absolute",
    left: 5,
    top: 12,
    width: 14,
    height: 10,
    borderBottomWidth: 1.7,
    borderLeftWidth: 1.7,
    borderRightWidth: 1.7,
  },
  heart: {
    position: "absolute",
    left: 6,
    top: 9,
    width: 13,
    height: 13,
    borderBottomWidth: 1.7,
    borderRightWidth: 1.7,
    transform: [{ rotate: "45deg" }],
  },
  heartLeft: {
    position: "absolute",
    left: 3,
    top: 4,
    width: 11,
    height: 12,
    borderWidth: 1.7,
    borderBottomColor: "transparent",
    borderRightColor: "transparent",
    borderRadius: 7,
    transform: [{ rotate: "-15deg" }],
  },
  heartRight: {
    position: "absolute",
    left: 12,
    top: 4,
    width: 11,
    height: 12,
    borderWidth: 1.7,
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    borderRadius: 7,
    transform: [{ rotate: "15deg" }],
  },
  back: {
    position: "absolute",
    left: 9,
    top: 5,
    width: 12,
    height: 12,
    borderLeftWidth: 1.8,
    borderBottomWidth: 1.8,
    transform: [{ rotate: "45deg" }],
  },
  note: {
    position: "absolute",
    left: 11,
    top: 3,
    width: 9,
    height: 15,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    transform: [{ skewY: "-15deg" }],
  },
  noteDot: {
    position: "absolute",
    left: 5,
    top: 15,
    width: 8,
    height: 6,
    borderRadius: 4,
  },
  plusH: {
    position: "absolute",
    left: 4,
    top: 11,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  plusV: {
    position: "absolute",
    left: 11,
    top: 4,
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  check: {
    position: "absolute",
    left: 4,
    top: 6,
    width: 14,
    height: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    transform: [{ rotate: "-45deg" }],
  },
  discOuter: {
    position: "absolute",
    left: 3,
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  discInner: {
    position: "absolute",
    left: 9,
    top: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  layer1: {
    position: "absolute",
    left: 4,
    top: 4,
    width: 16,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.6,
  },
  layer2: {
    position: "absolute",
    left: 4,
    top: 9,
    width: 16,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.6,
  },
  layer3: {
    position: "absolute",
    left: 4,
    top: 14,
    width: 16,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.6,
  },
  calBody: {
    position: "absolute",
    left: 4,
    top: 5,
    width: 16,
    height: 15,
    borderRadius: 3,
    borderWidth: 1.6,
  },
  calHeader: {
    position: "absolute",
    left: 4,
    top: 5,
    width: 16,
    height: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  dot1: {
    position: "absolute",
    left: 11,
    top: 4,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  dot2: {
    position: "absolute",
    left: 11,
    top: 10,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  dot3: {
    position: "absolute",
    left: 11,
    top: 16,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  menuLine1: {
    position: "absolute",
    left: 4,
    top: 6,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  menuLine2: {
    position: "absolute",
    left: 4,
    top: 11,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  menuLine3: {
    position: "absolute",
    left: 4,
    top: 16,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  arrowUp: {
    position: "absolute",
    left: 7,
    top: 8,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  arrowDown: {
    position: "absolute",
    left: 7,
    top: 5,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  trashCan: {
    position: "absolute",
    left: 6,
    top: 7,
    width: 12,
    height: 13,
    borderWidth: 1.6,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  trashLid: {
    position: "absolute",
    left: 4,
    top: 5,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  editPencil: {
    position: "absolute",
    left: 5,
    top: 5,
    width: 14,
    height: 14,
    borderWidth: 1.6,
    transform: [{ rotate: "45deg" }],
  },
  clockOuter: {
    position: "absolute",
    left: 3,
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
  },
  clockHandV: {
    position: "absolute",
    left: 11,
    top: 6,
    width: 1.8,
    height: 6,
    borderRadius: 1,
  },
  clockHandH: {
    position: "absolute",
    left: 11,
    top: 11,
    width: 5,
    height: 1.8,
    borderRadius: 1,
  },
  bellBody: {
    position: "absolute",
    left: 5,
    top: 4,
    width: 14,
    height: 12,
    borderWidth: 1.7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  bellBottom: {
    position: "absolute",
    left: 3,
    top: 15,
    width: 18,
    height: 1.8,
    borderRadius: 1,
  },
  bellClapper: {
    position: "absolute",
    left: 10,
    top: 17,
    width: 4,
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  compassRing: {
    position: "absolute",
    left: 3,
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.7,
  },
  compassNeedle: {
    position: "absolute",
    left: 11,
    top: 6,
    width: 2,
    height: 12,
    borderRadius: 1,
    transform: [{ rotate: "45deg" }],
  },
});
