import type { LandmarkPoint, ScreenPoint } from "./blazepose-types";

export type FrameSize = {
  width: number;
  height: number;
};

export type CoverTransformOptions = {
  frame: FrameSize;
  view: FrameSize;
  mirrored: boolean;
};

export function modelToFramePoint(point: LandmarkPoint, frame: FrameSize): ScreenPoint {
  return {
    x: point.x * frame.width,
    y: point.y * frame.height,
    visibility: point.visibility,
  };
}

export function frameToCoverViewPoint(
  point: ScreenPoint,
  { frame, view, mirrored }: CoverTransformOptions,
): ScreenPoint {
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  const drawnWidth = frame.width * scale;
  const drawnHeight = frame.height * scale;
  const cropX = (drawnWidth - view.width) / 2;
  const cropY = (drawnHeight - view.height) / 2;
  const frameX = mirrored ? frame.width - point.x : point.x;

  return {
    x: frameX * scale - cropX,
    y: point.y * scale - cropY,
    visibility: point.visibility,
  };
}

export function modelToCoverViewPoint(
  point: LandmarkPoint,
  options: CoverTransformOptions,
): ScreenPoint {
  return frameToCoverViewPoint(modelToFramePoint(point, options.frame), options);
}

export function isPointInsideView(point: ScreenPoint, view: FrameSize, margin = 24) {
  return (
    point.x >= -margin &&
    point.x <= view.width + margin &&
    point.y >= -margin &&
    point.y <= view.height + margin
  );
}
