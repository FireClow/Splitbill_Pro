import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOcrUrl } from '../utils/config';
import { Colors } from '../utils/colors';

interface ScannedReceipt {
  image_id: string;
  image_uri?: string;
  currency: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  tax: number;
  service_charge: number;
  total: number;
  confidence: number;
  ocr_text: string;
}

interface OcrInstallInstructions {
  download?: string;
  path?: string;
  verify_command?: string;
}

interface OcrErrorDetail {
  error?: string;
  install_instructions?: OcrInstallInstructions;
}

const formatOcrErrorMessage = (detail: unknown): string => {
  if (!detail) {
    return 'Failed to scan receipt. Please try again.';
  }

  if (typeof detail === 'string') {
    return detail;
  }

  const parsed = detail as OcrErrorDetail;
  if (parsed.error && parsed.install_instructions) {
    const instructions = parsed.install_instructions;
    return [
      parsed.error,
      instructions.download ? `Download: ${instructions.download}` : '',
      instructions.path ? `Install path: ${instructions.path}` : '',
      instructions.verify_command ? `Verify: ${instructions.verify_command}` : '',
    ].filter(Boolean).join('\n');
  }

  return 'Failed to scan receipt. Please try again.';
};

const inferMimeType = (fileName: string, blobType?: string): string => {
  if (blobType && blobType.startsWith('image/')) {
    return blobType;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
};

const readBlobAsDataUrl = async (blob: Blob): Promise<string> => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default function ScanReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();
  const [cameraMode, setCameraMode] = useState<'camera' | 'gallery' | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedReceipt | null>(null);
  const [hasAutoOpenedSource, setHasAutoOpenedSource] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Request permissions on mount
  useEffect(() => {
    if (permission?.status !== 'granted') {
      requestPermission();
    }
  }, [permission?.status, requestPermission]);

  // Upload image to backend for OCR processing
  const uploadAndScanReceipt = useCallback(async (imageUri: string) => {
    const uploadStartTime = Date.now();
    try {
      setLoading(true);
      setUploadProgress(5);
      setOcrError(null);
      console.log('[OCR] Starting upload from:', imageUri);

      const fileName = imageUri.split('/').pop() || 'receipt.jpg';

      let imageBlob: Blob | null = null;
      try {
        const blobResponse = await fetch(imageUri);
        imageBlob = await blobResponse.blob();
        console.log(`[OCR] Loaded blob directly, size=${imageBlob.size}`);
      } catch (blobError) {
        console.warn('[OCR] Direct blob load failed, will fallback to base64 JSON:', blobError);
      }

      // Send to backend
      console.log(`[OCR] Sending request to: ${getOcrUrl('scan')}`);

      // Get proper session token from storage
      const sessionToken = await AsyncStorage.getItem('session_token');
      const authHeader = sessionToken ? `Bearer ${sessionToken}` : 'Bearer guest';
      console.log(`[OCR] Auth header: ${authHeader.substring(0, 20)}...`);

      let response: { status: number; ok: boolean; bodyText: string } | null = null;
      let previewImageUri = imageUri;

      if (imageBlob && imageBlob.size > 0) {
        const mimeType = inferMimeType(fileName, imageBlob.type);
        const formData = new FormData();
        formData.append('file', imageBlob, fileName);
        setUploadProgress(20);
        console.log(`[OCR] Multipart upload prepared, mime=${mimeType}, size=${imageBlob.size}`);

        response = await new Promise<{ status: number; ok: boolean; bodyText: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', getOcrUrl('scan'));
          xhr.setRequestHeader('Authorization', authHeader);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentage = Math.min(95, Math.round((event.loaded / event.total) * 100));
              setUploadProgress(Math.max(20, percentage));
            }
          };

          xhr.onload = () => {
            resolve({
              status: xhr.status,
              ok: xhr.status >= 200 && xhr.status < 300,
              bodyText: xhr.responseText || '',
            });
          };

          xhr.onerror = () => reject(new Error('Network error while uploading receipt'));
          xhr.send(formData as any);
        });

        // Fallback to base64 JSON for compatibility issues on some runtimes.
        if (!response.ok && (response.status === 400 || response.status === 415 || response.status === 422)) {
          console.warn('[OCR] Multipart rejected, retrying with JSON base64 payload');
          response = null;
        }
      }

      if (!response) {
        let dataUrl = '';
        if (imageBlob && imageBlob.size > 0) {
          dataUrl = await readBlobAsDataUrl(imageBlob);
        } else {
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: 'base64',
          });
          const mimeType = inferMimeType(fileName);
          dataUrl = `data:${mimeType};base64,${base64}`;
        }
        previewImageUri = dataUrl;
        setUploadProgress(90);

        const jsonResponse = await fetch(getOcrUrl('scan'), {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: dataUrl }),
        });
        response = {
          status: jsonResponse.status,
          ok: jsonResponse.ok,
          bodyText: await jsonResponse.text(),
        };
      }

      console.log(`[OCR] Response status: ${response.status}`);

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errorData = JSON.parse(response.bodyText) as any;
          errorMsg = formatOcrErrorMessage(errorData?.detail || errorData?.message || errorData);
          console.error('[OCR] Backend error:', errorData);
        } catch (e) {
          console.error('[OCR] Failed to parse error response:', e);
        }
        throw new Error(errorMsg);
      }

      const result = JSON.parse(response.bodyText) as ScannedReceipt;
      setUploadProgress(100);
      console.log('[OCR] Upload successful! Receipt ID:', result.image_id);
      console.log('[OCR] Upload time:', Date.now() - uploadStartTime, 'ms');

      // Auto-navigate to Review screen immediately after successful upload
      if (result.image_id) {
        console.log('[OCR] Navigating to review screen with receipt ID:', result.image_id);
        console.log('[OCR] Scanned data items:', result.items?.length || 0);

        // Clear loading before navigation
        // Navigate to review screen
        try {
          console.log('[OCR] Calling router.replace...');
          router.replace({
            pathname: '/review-receipt',
            params: {
              receiptId: result.image_id,
              scannedData: JSON.stringify({
                ...result,
                image_uri: previewImageUri,
              }),
            },
          });
          console.log('[OCR] router.replace called successfully');
        } catch (navError) {
          console.error('[OCR] Navigation error:', navError);
          Alert.alert('Navigation Error', 'Could not navigate to review screen');
        }
      } else {
        throw new Error('No receipt ID returned from server');
      }
    } catch (error: any) {
      console.error('[OCR] Upload error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setOcrError(errorMsg);
      Alert.alert(
        'OCR Failed',
        errorMsg || 'Failed to scan receipt. Please try again.'
      );
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 200);
    }
  }, [router]);

  // Handle taking photo with camera
  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: true,
      });

      if (photo?.uri) {
        await uploadAndScanReceipt(photo.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      console.error('Camera error:', error);
    } finally {
      setLoading(false);
    }
  }, [uploadAndScanReceipt]);

  // Handle gallery image selection
  const handlePickImage = useCallback(async () => {
    try {
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await uploadAndScanReceipt(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      console.error('Image picker error:', error);
    } finally {
      setLoading(false);
    }
  }, [uploadAndScanReceipt]);

  useEffect(() => {
    if (hasAutoOpenedSource) return;
    if (params.source === 'camera') {
      setCameraMode('camera');
      setHasAutoOpenedSource(true);
      return;
    }
    if (params.source === 'gallery') {
      setHasAutoOpenedSource(true);
      handlePickImage();
    }
  }, [params.source, hasAutoOpenedSource, handlePickImage]);

  // Navigate to review screen with scanned data
  const handleReviewResults = () => {
    if (scanned) {
      router.push({
        pathname: '/review-receipt',
        params: {
          scannedData: JSON.stringify(scanned),
        },
      });
    }
  };

  // Reset scan
  const handleRetakeScan = () => {
    setScanned(null);
    setCameraMode(null);
  };

  // Render camera view
  if (cameraMode === 'camera' && permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => console.log('Camera ready')}
        >
          {/* Camera header */}
          <View style={styles.cameraHeader}>
            <TouchableOpacity
              onPress={() => {
                setCameraMode(null);
                router.replace('/');
              }}
              style={styles.cameraCloseButton}
            >
              <MaterialCommunityIcons name="close" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.cameraHeaderContent}>
              <Text style={styles.cameraTitle}>Align receipt</Text>
              <Text style={styles.cameraSubtitle}>Center it in the frame</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Focus frame */}
          <View style={styles.focusFrame}>
            <Text style={styles.frameText}>📸</Text>
          </View>

          {/* Camera buttons */}
          <View style={styles.cameraFooter}>
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={loading}
              style={styles.galleryButton}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="image-multiple" size={24} color="white" />
              <Text style={styles.galleryButtonText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTakePhoto}
              disabled={loading}
              style={[styles.captureButton, loading && styles.captureButtonDisabled]}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.primaryForeground} size={28} />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>

            <View style={{ width: 60 }} />
          </View>
        </CameraView>

        {/* Loading overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="white" size="large" />
            <Text style={styles.loadingText}>📸 Processing receipt...</Text>
            <Text style={styles.loadingSubtext}>Uploading and analyzing... {uploadProgress}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // Render scanned results
  if (scanned) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => {
                setScanned(null);
                setCameraMode(null);
                router.replace('/');
              }} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Receipt Details</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Confidence badge */}
            <View
              style={[
                styles.confidenceBadge,
                {
                  backgroundColor:
                    scanned.confidence > 0.8
                      ? Colors.success
                      : scanned.confidence > 0.6
                      ? Colors.warning
                      : Colors.error,
                },
              ]}
            >
              <Text style={styles.confidenceEmoji}>
                {scanned.confidence > 0.8 ? '✅' : scanned.confidence > 0.6 ? '⚠️' : '❌'}
              </Text>
              <Text style={styles.confidenceText}>
                {Math.round(scanned.confidence * 100)}% accuracy
              </Text>
            </View>

            {/* Total amount - Big and clear */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>
                {scanned.currency} {scanned.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={styles.itemCountText}>{scanned.items.length} items detected</Text>
            </View>

            {/* Breakdown */}
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Subtotal</Text>
                <Text style={styles.breakdownValue}>{scanned.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              {scanned.tax > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Tax</Text>
                  <Text style={styles.breakdownValue}>{scanned.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              )}
              {scanned.service_charge > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Service</Text>
                  <Text style={styles.breakdownValue}>{scanned.service_charge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              )}
            </View>

            {/* Items preview */}
            <View style={styles.itemsCard}>
              <Text style={styles.itemsTitle}>Items</Text>
              {scanned.items.slice(0, 5).map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={styles.itemRowLeft}>
                    <Text style={styles.itemQty}>{item.quantity}x</Text>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>{item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              ))}
              {scanned.items.length > 5 && (
                <Text style={styles.moreCountText}>+{scanned.items.length - 5} more items</Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Action buttons - fixed at bottom */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            onPress={handleRetakeScan}
            style={styles.secondaryButton}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="camera-retake" size={18} color={Colors.text} />
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReviewResults}
            style={styles.primaryButton}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Proceed</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render initial screen
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/')} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Receipt</Text>
            <View style={{ width: 24 }} />
          </View>

          {ocrError && (
            <View style={styles.errorCard}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{ocrError}</Text>
            </View>
          )}

          {/* Illustration */}
          <View style={styles.illustration}>
            <Text style={styles.illustrationEmoji}>📸</Text>
            <Text style={styles.illustrationText}>Quick Scan</Text>
            <Text style={styles.illustrationSubtext}>
              Let the camera do the work
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              onPress={() => setCameraMode('camera')}
              style={styles.optionButton}
              activeOpacity={0.7}
            >
              <View style={styles.optionButtonLeft}>
                <Text style={styles.optionIcon}>📷</Text>
                <View>
                  <Text style={styles.optionTitle}>Take Photo</Text>
                  <Text style={styles.optionDesc}>Use your camera</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickImage}
              disabled={loading}
              style={[styles.optionButton, loading && styles.optionButtonDisabled]}
              activeOpacity={0.7}
            >
              <View style={styles.optionButtonLeft}>
                {loading ? (
                  <ActivityIndicator color={Colors.primary} size={20} />
                ) : (
                  <Text style={styles.optionIcon}>🖼️</Text>
                )}
                <View>
                  <Text style={styles.optionTitle}>Choose Photo</Text>
                  <Text style={styles.optionDesc}>From your gallery</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/create-bill')}
              style={styles.optionButton}
              activeOpacity={0.7}
            >
              <View style={styles.optionButtonLeft}>
                <Text style={styles.optionIcon}>✏️</Text>
                <View>
                  <Text style={styles.optionTitle}>Type Manually</Text>
                  <Text style={styles.optionDesc}>Enter items by hand</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Info section */}
          <View style={styles.infoSection}>
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <View>
                <Text style={styles.infoTitle}>Pro tip</Text>
                <Text style={styles.infoText}>For best results, take a clear photo in good lighting</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  illustration: {
    alignItems: 'center',
    marginVertical: 32,
  },
  illustrationEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  illustrationText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  illustrationSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 8,
    marginBottom: 32,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionButtonDisabled: {
    opacity: 0.6,
  },
  optionButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionIcon: {
    fontSize: 28,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  optionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  infoSection: {
    marginTop: 16,
    marginBottom: 32,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  // Camera styles
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHeaderContent: {
    flex: 1,
    alignItems: 'center',
  },
  cameraTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  cameraSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  focusFrame: {
    flex: 1,
    marginHorizontal: 32,
    marginVertical: 48,
    borderWidth: 2,
    borderColor: 'rgba(212,244,120,0.6)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameText: {
    fontSize: 48,
    opacity: 0.3,
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primaryForeground,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  galleryButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontSize: 12,
  },
  progressTrack: {
    width: 220,
    height: 8,
    borderRadius: 999,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error + '66',
    backgroundColor: Colors.error + '12',
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: 12,
    lineHeight: 18,
  },
  // Results styles
  confidenceBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
  },
  confidenceEmoji: {
    fontSize: 16,
  },
  confidenceText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  totalCard: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
  },
  totalAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },
  itemCountText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  breakdownCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  breakdownLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  itemsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    minWidth: 24,
  },
  itemName: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 50,
    textAlign: 'right',
  },
  moreCountText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 8,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: {
    color: Colors.primaryForeground,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
