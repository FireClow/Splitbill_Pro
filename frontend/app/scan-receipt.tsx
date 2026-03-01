import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOcrUrl } from '../utils/config';

interface ScannedReceipt {
  image_id: string;
  image_uri?: string;
  currency: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  tax: number;
  service_charge: number;
  total: number;
  confidence: number;
  ocr_text: string;
}

export default function ScanReceiptScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cameraMode, setCameraMode] = useState<'camera' | 'gallery' | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState<ScannedReceipt | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Request permissions on mount
  useEffect(() => {
    if (permission?.status !== 'granted') {
      requestPermission();
    }
  }, []);

  // Handle taking photo with camera
  const handleTakePhoto = async () => {
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
  };

  // Handle gallery image selection
  const handlePickImage = async () => {
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
  };

  // Upload image to backend for OCR processing
  const uploadAndScanReceipt = async (imageUri: string) => {
    let uploadStartTime = Date.now();
    try {
      setLoading(true);
      console.log('[OCR] Starting upload from:', imageUri);

      // Detect if this is a blob URI (web platform)
      const isBlobUri = imageUri.startsWith('blob:');
      console.log('[OCR] Is blob URI:', isBlobUri);

      let base64 = '';
      const fileName = imageUri.split('/').pop() || 'receipt.jpg';

      // Handle blob URI (web)
      if (isBlobUri) {
        console.log('[OCR] Converting blob URI to base64...');
        try {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const reader = new FileReader();
          
          base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64String = result.split(',')[1]; // extract base64 part
              resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log(`[OCR] Blob converted to base64, length: ${base64.length}`);
        } catch (blobError) {
          console.error('[OCR] Failed to convert blob:', blobError);
          throw new Error('Failed to process image');
        }
      } else {
        // Handle native URI
        console.log('[OCR] Reading native file URI...');
        try {
          base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: 'base64',
          });
          console.log(`[OCR] File read, base64 length: ${base64.length}`);
        } catch (readError) {
          console.warn('[OCR] FileSystem read failed:', readError);
          throw new Error('Failed to read image file');
        }
      }

      // Determine MIME type
      const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
      console.log(`[OCR] MIME type: ${mimeType}`);

      // Convert to data URL for display
      const dataUrl = `data:${mimeType};base64,${base64}`;
      console.log(`[OCR] DataURL created, length: ${dataUrl.length}`);

      // Create FormData for upload
      const formData = new FormData();
      
      try {
        const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const blob = new Blob([byteArray], { type: mimeType });
        formData.append('file', blob, fileName);
        console.log(`[OCR] Form data prepared with blob size: ${blob.size} bytes`);
      } catch (blobCreateError) {
        console.error('[OCR] Blob creation failed:', blobCreateError);
        throw new Error('Failed to prepare file for upload');
      }

      // Send to backend
      console.log(`[OCR] Sending request to: ${getOcrUrl('scan')}`);
      
      // Get proper session token from storage
      const sessionToken = await AsyncStorage.getItem('session_token');
      const authHeader = sessionToken ? `Bearer ${sessionToken}` : 'Bearer guest';
      console.log(`[OCR] Auth header: ${authHeader.substring(0, 20)}...`);
      
      const response = await fetch(getOcrUrl('scan'), {
        method: 'POST',
        headers: {
          Authorization: authHeader,
        },
        body: formData as any,
      });

      console.log(`[OCR] Response status: ${response.status}`);

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errorData = await response.json() as any;
          errorMsg = errorData?.detail || errorData?.message || errorMsg;
          console.error('[OCR] Backend error:', errorData);
        } catch (e) {
          console.error('[OCR] Failed to parse error response:', e);
        }
        throw new Error(errorMsg);
      }

      const result = await response.json() as ScannedReceipt;
      console.log('[OCR] Upload successful! Receipt ID:', result.image_id);
      console.log('[OCR] Upload time:', Date.now() - uploadStartTime, 'ms');

      // ✅ IMPORTANT: Auto-navigate to Review screen immediately after successful upload
      if (result.image_id) {
        console.log('[OCR] Navigating to review screen with receipt ID:', result.image_id);
        console.log('[OCR] Scanned data items:', result.items?.length || 0);
        
        // Clear loading before navigation
        setLoading(false);
        
        // Navigate to review screen
        try {
          console.log('[OCR] Calling router.replace...');
          router.replace({
            pathname: '/review-receipt',
            params: {
              receiptId: result.image_id,
              scannedData: JSON.stringify({
                ...result,
                image_uri: dataUrl,
              }),
            },
          });
          console.log('[OCR] router.replace called successfully');
        } catch (navError) {
          console.error('[OCR] Navigation error:', navError);
          Alert.alert('Navigation Error', 'Could not navigate to review screen');
          setLoading(false);
        }
      } else {
        throw new Error('No receipt ID returned from server');
      }
    } catch (error: any) {
      console.error('[OCR] Upload error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'OCR Failed',
        errorMsg || 'Failed to scan receipt. Please try again.'
      );
      setLoading(false);
    }
  };

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
              onPress={() => setCameraMode(null)}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Align receipt with frame</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Focus frame */}
          <View style={styles.focusFrame} />

          {/* Camera buttons */}
          <View style={styles.cameraFooter}>
            <TouchableOpacity
              onPress={handlePickImage}
              style={styles.galleryButton}
            >
              <MaterialCommunityIcons name="image" size={24} color="#06B6D4" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTakePhoto}
              disabled={loading}
              style={[styles.captureButton, loading && styles.captureButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="white" size={40} />
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
            <Text style={styles.loadingSubtext}>Uploading and analyzing...</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // Render scanned results
  if (scanned) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setCameraMode(null)}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Results</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Results summary */}
          <View style={styles.resultsCard}>
            {/* Confidence badge */}
            <View style={[
              styles.confidenceBadge,
              { backgroundColor: scanned.confidence > 0.8 ? '#10B981' : scanned.confidence > 0.6 ? '#F59E0B' : '#EF4444' }
            ]}>
              <Text style={styles.confidenceText}>
                {Math.round(scanned.confidence * 100)}% confidence
              </Text>
            </View>

            {/* Items count */}
            <Text style={styles.itemsCount}>
              {scanned.items.length} items detected
            </Text>

            {/* Total */}
            <Text style={styles.totalAmount}>
              {scanned.currency} {scanned.total.toFixed(2)}
            </Text>

            {/* Details */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Subtotal</Text>
                <Text style={styles.detailValue}>{scanned.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Tax</Text>
                <Text style={styles.detailValue}>{scanned.tax.toFixed(2)}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Service</Text>
                <Text style={styles.detailValue}>{scanned.service_charge.toFixed(2)}</Text>
              </View>
            </View>

            {/* Items preview */}
            <View style={styles.itemsPreview}>
              <Text style={styles.previewTitle}>Items:</Text>
              {scanned.items.slice(0, 3).map((item, idx) => (
                <View key={idx} style={styles.itemPreview}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDetails}>
                    {item.quantity}x {item.price.toFixed(2)}
                  </Text>
                </View>
              ))}
              {scanned.items.length > 3 && (
                <Text style={styles.moreItems}>+{scanned.items.length - 3} more</Text>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleRetakeScan}
              style={styles.secondaryButton}
            >
              <MaterialCommunityIcons name="camera-retake" size={20} color="#0F172A" />
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleReviewResults}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Review & Edit</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render initial screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Receipt</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Illustration */}
        <View style={styles.illustration}>
          <MaterialCommunityIcons name="receipt" size={100} color="#3B82F6" />
          <Text style={styles.illustrationText}>Scan your receipt</Text>
          <Text style={styles.illustrationSubtext}>
            Automatically extract items and prices
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            onPress={() => setCameraMode('camera')}
            style={styles.optionCard}
          >
            <View style={styles.optionIconContainer}>
              <MaterialCommunityIcons name="camera" size={40} color="#3B82F6" />
            </View>
            <Text style={styles.optionTitle}>Take Photo</Text>
            <Text style={styles.optionDescription}>Use camera to scan receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickImage}
            disabled={loading}
            style={[styles.optionCard, loading && styles.optionCardDisabled]}
          >
            <View style={styles.optionIconContainer}>
              {loading ? (
                <ActivityIndicator color="#3B82F6" size={40} />
              ) : (
                <MaterialCommunityIcons name="image" size={40} color="#3B82F6" />
              )}
            </View>
            <Text style={styles.optionTitle}>Upload Photo</Text>
            <Text style={styles.optionDescription}>Choose from photo gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Manual entry */}
        <View style={styles.manualSection}>
          <TouchableOpacity
            onPress={() => router.push('/create-bill')}
            style={styles.manualButton}
          >
            <MaterialCommunityIcons name="pencil" size={18} color="#0F172A" />
            <Text style={styles.manualButtonText}>Enter manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  illustration: {
    alignItems: 'center',
    marginVertical: 40,
  },
  illustrationText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 16,
  },
  illustrationSubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionCardDisabled: {
    opacity: 0.6,
  },
  optionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  manualSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  manualButtonText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  // Camera styles
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cameraTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 14,
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    fontSize: 12,
  },
  // Results styles
  resultsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  itemsCount: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemsPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  itemPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 12,
    color: '#0F172A',
    flex: 1,
  },
  itemDetails: {
    fontSize: 12,
    color: '#64748B',
  },
  moreItems: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
});
