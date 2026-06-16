import { Stage, Layer, Rect, Text } from "react-konva";

export default function Editor() {
  return (
    <Stage width={window.innerWidth} height={window.innerHeight}>
      <Layer>
        <Rect
          x={50}
          y={50}
          width={200}
          height={200}
          fill="lightblue"
          draggable
        />
        <Text
          text="Hello Ownize AI Studio"
          x={100}
          y={100}
          fontSize={24}
          draggable
        />
      </Layer>
    </Stage>
  );
}