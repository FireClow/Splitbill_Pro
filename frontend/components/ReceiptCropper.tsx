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
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: (points: CropPoint[]) => void;
}

const HANDLE_RADIUS = 12;
const MIN_EDGE = 26;
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
  disabled = false,
  onCancel,
  onConfirm,
}: ReceiptCropperProps) {
  const initialViewport = Dimensions.get('window');
  const [containerWidth, setContainerWidth] = useState(initialViewport.width);
  const [containerHeight, setContainerHeight] = useState(Math.max(320, initialViewport.height - 220));
  const [corners, setCorners] = useState<CropCorners | null>(null);
  const [activeCorner, setActiveCorner] = useState<CornerKey | null>(null);

  const cornersRef = useRef<CropCorners | null>(null);
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
    if (!frame) return;
    const next = buildDefaultCorners(frame);
    setCorners(next);
    cornersRef.current = next;
  }, [frame]);

  const updateCorner = (corner: CornerKey, nextX: number, nextY: number) => {
    if (!frame || !cornersRef.current) return;

    const current = cornersRef.current;

    const minX = frame.x;
    const maxX = frame.x + frame.width;
    const minY = frame.y;
    const maxY = frame.y + frame.height;

    let x = clamp(nextX, minX, maxX);
    let y = clamp(nextY, minY, maxY);

    if (corner === 'tl') {
      x = Math.min(x, current.tr.x - MIN_EDGE, current.bl.x - MIN_EDGE);
      y = Math.min(y, current.bl.y - MIN_EDGE, current.tr.y - MIN_EDGE);
    } else if (corner === 'tr') {
      x = Math.max(x, current.tl.x + MIN_EDGE, current.br.x + MIN_EDGE);
      y = Math.min(y, current.br.y - MIN_EDGE, current.tl.y - MIN_EDGE);
    } else if (corner === 'bl') {
      x = Math.min(x, current.br.x - MIN_EDGE, current.tl.x - MIN_EDGE);
      y = Math.max(y, current.tl.y + MIN_EDGE, current.br.y + MIN_EDGE);
    } else {
      x = Math.max(x, current.bl.x + MIN_EDGE, current.tr.x + MIN_EDGE);
      y = Math.max(y, current.tr.y + MIN_EDGE, current.bl.y + MIN_EDGE);
    }

    x = clamp(x, minX, maxX);
    y = clamp(y, minY, maxY);

    const updated: CropCorners = {
      ...current,
      [corner]: { x, y },
    };

    cornersRef.current = updated;
    setCorners(updated);
  };

  const createPanResponder = (corner: CornerKey) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        if (!cornersRef.current) return;
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
        <Text style={styles.tipText}>Drag each corner to tightly fit the receipt edges.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={disabled}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => {
            const next = buildDefaultCorners(frame);
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
