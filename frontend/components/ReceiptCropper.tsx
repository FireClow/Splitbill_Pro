import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface CropPoint {
  x: number;
  y: number;
}

type CornerKey = 'tl' | 'tr' | 'bl' | 'br';

interface CropCorners {
  tl: CropPoint;
  tr: CropPoint;
  bl: CropPoint;
  br: CropPoint;
}

interface ImageFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ReceiptCropperProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  initialPoints?: CropPoint[] | null;
  initialPointsVersion?: number;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: (points: CropPoint[]) => void;
}

const HANDLE_RADIUS = 12;
const MIN_EDGE = 26;
const MIN_AREA = 600;
const FRAME_PADDING = 12;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const buildDefaultCorners = (frame: ImageFrame): CropCorners => {
  const insetX = Math.max(12, frame.width * 0.08);
  const insetY = Math.max(12, frame.height * 0.08);

  return {
    tl: { x: frame.x + insetX, y: frame.y + insetY },
    tr: { x: frame.x + frame.width - insetX, y: frame.y + insetY },
    bl: { x: frame.x + insetX, y: frame.y + frame.height - insetY },
    br: { x: frame.x + frame.width - insetX, y: frame.y + frame.height - insetY },
  };
};

const toOrderedPoints = (corners: CropCorners): CropPoint[] => {
  return [corners.tl, corners.tr, corners.br, corners.bl];
};

const polygonArea = (points: CropPoint[]): number => {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return Math.abs(area) * 0.5;
};

const segmentsIntersect = (a1: CropPoint, a2: CropPoint, b1: CropPoint, b2: CropPoint): boolean => {
  const orient = (p: CropPoint, q: CropPoint, r: CropPoint) => {
    return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  };

  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);
  return o1 * o2 < 0 && o3 * o4 < 0;
};

const isSelfIntersecting = (points: CropPoint[]): boolean => {
  if (points.length !== 4) {
    return true;
  }
  return segmentsIntersect(points[0], points[1], points[2], points[3]) || segmentsIntersect(points[1], points[2], points[3], points[0]);
};

const isValidCorners = (corners: CropCorners): boolean => {
  const points = toOrderedPoints(corners);
  const edgeLengths = [
    Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
    Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y),
    Math.hypot(points[3].x - points[2].x, points[3].y - points[2].y),
    Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y),
  ];

  if (edgeLengths.some((len) => len < MIN_EDGE)) {
    return false;
  }

  if (polygonArea(points) < MIN_AREA) {
    return false;
  }

  if (isSelfIntersecting(points)) {
    return false;
  }

  return true;
};

const mapPointBetweenFrames = (point: CropPoint, from: ImageFrame, to: ImageFrame): CropPoint => {
  const nx = clamp((point.x - from.x) / from.width, 0, 1);
  const ny = clamp((point.y - from.y) / from.height, 0, 1);
  return {
    x: to.x + nx * to.width,
    y: to.y + ny * to.height,
  };
};

const mapCornersBetweenFrames = (corners: CropCorners, from: ImageFrame, to: ImageFrame): CropCorners => {
  return {
    tl: mapPointBetweenFrames(corners.tl, from, to),
    tr: mapPointBetweenFrames(corners.tr, from, to),
    br: mapPointBetweenFrames(corners.br, from, to),
    bl: mapPointBetweenFrames(corners.bl, from, to),
  };
};

const cornersFromImagePoints = (
  points: CropPoint[] | null | undefined,
  frame: ImageFrame,
  imageWidth: number,
  imageHeight: number
): CropCorners | null => {
  if (!points || points.length !== 4 || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const [tl, tr, br, bl] = points;
  const toUiPoint = (point: CropPoint): CropPoint => ({
    x: frame.x + clamp(point.x / imageWidth, 0, 1) * frame.width,
    y: frame.y + clamp(point.y / imageHeight, 0, 1) * frame.height,
  });

  const converted: CropCorners = {
    tl: toUiPoint(tl),
    tr: toUiPoint(tr),
    br: toUiPoint(br),
    bl: toUiPoint(bl),
  };

  if (!isValidCorners(converted)) {
    return null;
  }

  return converted;
};

const convertToImagePoints = (corners: CropCorners, frame: ImageFrame, imageWidth: number, imageHeight: number): CropPoint[] => {
  const ordered = [corners.tl, corners.tr, corners.br, corners.bl];

  return ordered.map((point) => {
    const normalizedX = clamp((point.x - frame.x) / frame.width, 0, 1);
    const normalizedY = clamp((point.y - frame.y) / frame.height, 0, 1);

    return {
      x: Math.round(normalizedX * imageWidth),
      y: Math.round(normalizedY * imageHeight),
    };
  });
};

export function ReceiptCropper({
  imageUri,
  imageWidth,
  imageHeight,
  initialPoints,
  initialPointsVersion = 0,
  disabled = false,
  onCancel,
  onConfirm,
}: ReceiptCropperProps) {
  const initialViewport = Dimensions.get('window');
  const [containerWidth, setContainerWidth] = useState(initialViewport.width);
  const [containerHeight, setContainerHeight] = useState(Math.max(320, initialViewport.height - 220));
  const [corners, setCorners] = useState<CropCorners | null>(null);
  const [activeCorner, setActiveCorner] = useState<CornerKey | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);

  const cornersRef = useRef<CropCorners | null>(null);
  const frameRef = useRef<ImageFrame | null>(null);
  const userInteractedRef = useRef(false);
  const dragStartRef = useRef<CropPoint>({ x: 0, y: 0 });
  const cornerStartRef = useRef<CropPoint>({ x: 0, y: 0 });

  const frame = useMemo<ImageFrame | null>(() => {
    if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
      return null;
    }

    const availableWidth = Math.max(0, containerWidth - FRAME_PADDING * 2);
    const availableHeight = Math.max(0, containerHeight - FRAME_PADDING * 2);
    const imageAspect = imageWidth / imageHeight;
    const containerAspect = availableWidth / availableHeight;

    let width = availableWidth;
    let height = availableHeight;

    if (containerAspect > imageAspect) {
      width = availableHeight * imageAspect;
      height = availableHeight;
    } else {
      width = availableWidth;
      height = availableWidth / imageAspect;
    }

    return {
      x: (containerWidth - width) / 2,
      y: (containerHeight - height) / 2,
      width,
      height,
    };
  }, [containerWidth, containerHeight, imageWidth, imageHeight]);

  useEffect(() => {
    if (!frame) {
      return;
    }

    const prevFrame = frameRef.current;
    frameRef.current = frame;

    if (!prevFrame || !cornersRef.current) {
      const seeded = cornersFromImagePoints(initialPoints, frame, imageWidth, imageHeight);
      const next = seeded ?? buildDefaultCorners(frame);
      setCorners(next);
      cornersRef.current = next;
      return;
    }

    const remapped = mapCornersBetweenFrames(cornersRef.current, prevFrame, frame);
    if (isValidCorners(remapped)) {
      cornersRef.current = remapped;
      setCorners(remapped);
      return;
    }

    const fallback = buildDefaultCorners(frame);
    cornersRef.current = fallback;
    setCorners(fallback);
  }, [frame, imageWidth, imageHeight, initialPoints]);

  useEffect(() => {
    if (!frame || userInteractedRef.current) {
      return;
    }

    const seeded = cornersFromImagePoints(initialPoints, frame, imageWidth, imageHeight);
    const next = seeded ?? buildDefaultCorners(frame);
    cornersRef.current = next;
    setCorners(next);
    setIsManualMode(false);
  }, [initialPointsVersion, initialPoints, frame, imageWidth, imageHeight]);

  const updateCorner = (corner: CornerKey, nextX: number, nextY: number) => {
    if (!frame || !cornersRef.current) return;

    const x = clamp(nextX, frame.x, frame.x + frame.width);
    const y = clamp(nextY, frame.y, frame.y + frame.height);

    const updated: CropCorners = {
      ...cornersRef.current,
      [corner]: { x, y },
    };

    if (!isValidCorners(updated)) {
      return;
    }

    cornersRef.current = updated;
    setCorners(updated);
  };

  const createPanResponder = (corner: CornerKey) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        if (!cornersRef.current) return;
        userInteractedRef.current = true;
        setIsManualMode(true);
        setActiveCorner(corner);
        dragStartRef.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        cornerStartRef.current = { ...cornersRef.current[corner] };
      },
      onPanResponderMove: (evt) => {
        const deltaX = evt.nativeEvent.pageX - dragStartRef.current.x;
        const deltaY = evt.nativeEvent.pageY - dragStartRef.current.y;
        updateCorner(corner, cornerStartRef.current.x + deltaX, cornerStartRef.current.y + deltaY);
      },
      onPanResponderRelease: () => {
        setActiveCorner(null);
      },
      onPanResponderTerminate: () => {
        setActiveCorner(null);
      },
    });
  };

  const panResponders = useMemo(() => {
    return {
      tl: createPanResponder('tl'),
      tr: createPanResponder('tr'),
      bl: createPanResponder('bl'),
      br: createPanResponder('br'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, frame]);

  const polygonPoints = useMemo(() => {
    if (!corners || !frame) {
      return '';
    }

    return [corners.tl, corners.tr, corners.br, corners.bl]
      .map((point) => `${point.x - frame.x},${point.y - frame.y}`)
      .join(' ');
  }, [corners, frame]);

  const overlayPath = useMemo(() => {
    if (!corners || !frame) {
      return '';
    }

    const outer = `M0 0 H${frame.width} V${frame.height} H0 Z`;
    const inner = [corners.tl, corners.tr, corners.br, corners.bl]
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x - frame.x} ${point.y - frame.y}`)
      .join(' ');

    return `${outer} ${inner} Z`;
  }, [corners, frame]);

  if (!frame || !corners) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loaderText}>Preparing crop tool...</Text>
      </View>
    );
  }

  const handleConfirm = () => {
    const imagePoints = convertToImagePoints(corners, frame, imageWidth, imageHeight);
    onConfirm(imagePoints);
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.canvasContainer}
        onLayout={(event) => {
          setContainerWidth(event.nativeEvent.layout.width);
          setContainerHeight(event.nativeEvent.layout.height);
        }}
      >
        <Image
          source={{ uri: imageUri }}
          style={{
            position: 'absolute',
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          }}
          resizeMode="stretch"
        />

        <View
          style={{
            position: 'absolute',
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          }}
          pointerEvents="none"
        >
          <Svg width={frame.width} height={frame.height}>
            <Path d={overlayPath} fill="rgba(0, 0, 0, 0.6)" fillRule="evenodd" />
            <Polygon points={polygonPoints} fill="rgba(37, 99, 235, 0.16)" stroke="#60A5FA" strokeWidth={2} />
          </Svg>
        </View>

        {(Object.keys(corners) as CornerKey[]).map((corner) => {
          const point = corners[corner];
          const isActive = activeCorner === corner;

          return (
            <View
              key={corner}
              style={[
                styles.handle,
                {
                  left: point.x - HANDLE_RADIUS,
                  top: point.y - HANDLE_RADIUS,
                },
                isActive && styles.handleActive,
              ]}
              {...panResponders[corner].panHandlers}
            >
              <View style={styles.handleDot} />
            </View>
          );
        })}
      </View>

      <View style={styles.tipBox}>
        <MaterialCommunityIcons name="gesture-tap-hold" size={18} color="#BFDBFE" />
        <Text style={styles.tipText}>
          {isManualMode
            ? 'Manual mode active. Auto suggestion is locked and will not override your corners.'
            : 'Auto suggestion is loaded once. Drag any corner to switch to manual mode.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={disabled}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => {
            userInteractedRef.current = false;
            setIsManualMode(false);
            const seeded = cornersFromImagePoints(initialPoints, frame, imageWidth, imageHeight);
            const next = seeded ?? buildDefaultCorners(frame);
            cornersRef.current = next;
            setCorners(next);
          }}
          disabled={disabled}
        >
          <MaterialCommunityIcons name="restore" size={16} color="#1E3A8A" />
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.confirmButton, disabled && styles.confirmDisabled]} onPress={handleConfirm} disabled={disabled}>
          {disabled ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.confirmText}>Rescan Area</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
    gap: 8,
  },
  loaderText: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_RADIUS * 2,
    height: HANDLE_RADIUS * 2,
    borderRadius: HANDLE_RADIUS,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleActive: {
    transform: [{ scale: 1.12 }],
    borderColor: '#BAE6FD',
    backgroundColor: '#2563EB',
  },
  handleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E3A8A',
    borderRadius: 10,
  },
  tipText: {
    flex: 1,
    color: '#DBEAFE',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#020617',
  },
  cancelButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  resetButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
  },
  resetText: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1.3,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
  },
  confirmDisabled: {
    opacity: 0.65,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
