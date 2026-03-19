import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  SafeAreaView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOcrUrl } from '../utils/config';
import { CropPoint, ReceiptCropper } from '../components/ReceiptCropper';
import { Colors } from '../utils/colors';

interface ReceiptItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  subtotal?: number;
  confidence?: number;
}

interface ScannedReceipt {
  image_id: string;
  image_uri?: string;
  currency: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  service_charge: number;
  total: number;
  confidence: number;
  quality_metrics?: {
    parsing_error?: boolean;
    tax_ambiguous?: boolean;
  };
  ocr_text?: string;
}

const FALLBACK_IMAGE_DIMENSIONS = { width: 1200, height: 1800 };

const normalizeCropPoints = (points: CropPoint[]): CropPoint[] => {
  if (points.length !== 4) {
    return points;
  }

  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 }
  );

  const clockwise = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x);
    const angleB = Math.atan2(b.y - center.y, b.x - center.x);
    return angleA - angleB;
  });

  let startIndex = 0;
  let minScore = Number.POSITIVE_INFINITY;
  clockwise.forEach((point, index) => {
    const score = point.x + point.y;
    if (score < minScore) {
      minScore = score;
      startIndex = index;
    }
  });

  // Return ordered points: TL, TR, BR, BL.
  return [
    clockwise[startIndex],
    clockwise[(startIndex + 1) % 4],
    clockwise[(startIndex + 2) % 4],
    clockwise[(startIndex + 3) % 4],
  ];
};

const polygonArea = (points: CropPoint[]): number => {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    sum += points[i].x * next.y - next.x * points[i].y;
  }
  return Math.abs(sum) * 0.5;
};

export default function ReviewReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  let scannedData: (ScannedReceipt & { bill_title?: string }) | null = null;
  if (typeof params.scannedData === 'string') {
    try {
      const parsed = JSON.parse(params.scannedData);
      if (parsed && typeof parsed === 'object') {
        scannedData = parsed as ScannedReceipt & { bill_title?: string };
      }
    } catch (error) {
      console.warn('Invalid scannedData payload:', error);
    }
  }
  const billTitle = (typeof scannedData?.bill_title === 'string' ? scannedData.bill_title : '').trim();

  const [data, setData] = useState<ScannedReceipt>(scannedData || {
    currency: 'USD',
    items: [],
    subtotal: 0,
    tax: 0,
    service_charge: 0,
    total: 0,
    confidence: 0,
    image_id: '',
    image_uri: '',
  });

  const [showCropMode, setShowCropMode] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [cropSuggestion, setCropSuggestion] = useState<CropPoint[] | null>(null);
  const [cropSuggestionVersion, setCropSuggestionVersion] = useState(0);
  const cropSuggestionRequestRef = useRef(0);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ReceiptItem | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<ReceiptItem>({
    name: '',
    quantity: 1,
    price: 0,
  });

  // Calculate totals
  const calculateTotals = (items: ReceiptItem[]) => {
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const calculatedTotal = itemsSubtotal + data.tax + data.service_charge;
    return {
      subtotal: parseFloat(itemsSubtotal.toFixed(2)),
      total: parseFloat(calculatedTotal.toFixed(2)),
    };
  };

  const hasParsingWarning = Boolean(data.quality_metrics?.parsing_error);
  const hasTaxAmbiguousWarning = Boolean(data.quality_metrics?.tax_ambiguous);

  useEffect(() => {
    if (!data.image_uri) {
      setImageDimensions({ width: 0, height: 0 });
      return;
    }

    // Show cropper immediately with safe defaults while metadata resolves.
    setImageDimensions(FALLBACK_IMAGE_DIMENSIONS);

    Image.getSize(
      data.image_uri,
      (width, height) => {
        setImageDimensions({ width, height });
      },
      () => {}
    );
  }, [data.image_uri]);

  // Rescan with cropped area
  const handleRescanCropped = async (points: CropPoint[]) => {
    if (!data.image_uri) {
      Alert.alert('Error', 'No image available for rescan');
      return;
    }

    try {
      setIsRescanning(true);

      // Get session token
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) {
        Alert.alert('Error', 'Not authenticated');
        setIsRescanning(false);
        return;
      }

      const normalizedPoints = normalizeCropPoints(points);
      if (normalizedPoints.length !== 4 || polygonArea(normalizedPoints) < 25) {
        Alert.alert('Invalid Crop', 'Please adjust corners to form a valid crop area.');
        setIsRescanning(false);
        return;
      }

      // Send crop request to backend
      const formData = new FormData();
      formData.append('image_id', data.image_id);

      const xs = normalizedPoints.map((point) => point.x);
      const ys = normalizedPoints.map((point) => point.y);
      const minX = Math.round(Math.min(...xs));
      const maxX = Math.round(Math.max(...xs));
      const minY = Math.round(Math.min(...ys));
      const maxY = Math.round(Math.max(...ys));

      formData.append('crop_points_json', JSON.stringify(normalizedPoints));
      // Keep rectangular fallback fields for backward compatibility.
      formData.append('crop_x', String(minX));
      formData.append('crop_y', String(minY));
      formData.append('crop_width', String(Math.max(1, maxX - minX)));
      formData.append('crop_height', String(Math.max(1, maxY - minY)));

      const response = await fetch(getOcrUrl('rescan'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: formData as any,
      });
      
      if (response.ok) {
        const result = (await response.json()) as any;
        setData({
          ...data,
          items: result.items || [],
          subtotal: result.subtotal || 0,
          tax: result.tax || 0,
          service_charge: result.service_charge || 0,
          total: result.total || 0,
          confidence: result.confidence || 0,
          quality_metrics: result.quality_metrics || {},
          ocr_text: result.ocr_text || '',
        });
        setShowCropMode(false);
        Alert.alert('Success', 'Receipt rescanned and updated!');
      } else {
        Alert.alert('Error', 'Failed to rescan receipt');
      }
    } catch (error) {
      Alert.alert('Error', 'Rescan failed: ' + String(error));
    } finally {
      setIsRescanning(false);
    }
  };

  const openCropMode = async () => {
    setShowCropMode(true);
    setCropSuggestion(null);
    setCropSuggestionVersion((prev) => prev + 1);

    if (!data.image_id) {
      return;
    }

    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) {
        return;
      }

      const requestId = Date.now();
      cropSuggestionRequestRef.current = requestId;

      const formData = new FormData();
      formData.append('image_id', data.image_id);

      const response = await fetch(getOcrUrl('suggest'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: formData as any,
      });

      if (!response.ok || cropSuggestionRequestRef.current !== requestId) {
        return;
      }

      const payload = (await response.json()) as any;
      if (!Array.isArray(payload?.points) || payload.points.length !== 4) {
        return;
      }

      const parsedPoints = payload.points
        .map((point: any) => ({ x: Number(point?.x), y: Number(point?.y) }))
        .filter((point: CropPoint) => Number.isFinite(point.x) && Number.isFinite(point.y));

      if (parsedPoints.length !== 4) {
        return;
      }

      setCropSuggestion(normalizeCropPoints(parsedPoints));
      setCropSuggestionVersion((prev) => prev + 1);
    } catch {
      // Keep editor usable with default corners when suggestion endpoint is unavailable.
    }
  };

  // Confirm and save to database
  const handleConfirmReceipt = async () => {
    const normalizedItems = data.items
      .map((item) => ({
        ...item,
        name: (item.name || '').trim(),
        quantity: Number.isFinite(item.quantity) ? Math.max(1, Math.trunc(item.quantity)) : 1,
        price: Number.isFinite(item.price) ? Math.max(0, item.price) : 0,
      }))
      .filter((item) => item.name.length > 0 && item.price > 0);

    if (normalizedItems.length === 0) {
      Alert.alert('Validation', 'Please add at least one item');
      return;
    }

    const normalizedSubtotal = Number.parseFloat(
      normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
    );
    const normalizedTax = Number.parseFloat((Number(data.tax) || 0).toFixed(2));
    const normalizedServiceCharge = Number.parseFloat((Number(data.service_charge) || 0).toFixed(2));
    const normalizedTotal = Number.parseFloat((normalizedSubtotal + normalizedTax + normalizedServiceCharge).toFixed(2));

    try {
      setIsSaving(true);

      // Save to database via backend
      const payload = {
        image_id: data.image_id,
        currency: data.currency,
        items: normalizedItems,
        subtotal: normalizedSubtotal,
        tax: normalizedTax,
        service_charge: normalizedServiceCharge,
        total: normalizedTotal,
        confidence: data.confidence,
      };

      // Get session token
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) {
        Alert.alert('Error', 'Not authenticated');
        setIsSaving(false);
        return;
      }

      const response = await fetch(getOcrUrl('confirm'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = (await response.json()) as any;
        Alert.alert('Success', 'Receipt confirmed and saved!');
        
        // Navigate to create bill with confirmed data
        router.push({
          pathname: '/create-bill',
          params: {
            initialStep: '2',
            receiptData: JSON.stringify({
              ...data,
              items: normalizedItems,
              subtotal: normalizedSubtotal,
              tax: normalizedTax,
              service_charge: normalizedServiceCharge,
              total: normalizedTotal,
              bill_title: billTitle,
              bill_id: result.bill_id || '',
            }),
          },
        });
      } else {
        Alert.alert('Error', 'Failed to save receipt');
      }
    } catch (error) {
      Alert.alert('Error', 'Save failed: ' + String(error));
    } finally {
      setIsSaving(false);
    }
  };

  // Update item
  const handleUpdateItem = (item: ReceiptItem) => {
    const sanitizedName = (item.name || '').trim();
    const sanitizedQuantity = Number.isFinite(item.quantity) ? Math.max(1, Math.trunc(item.quantity)) : 1;
    const sanitizedPrice = Number.isFinite(item.price) ? Math.max(0, item.price) : 0;

    if (!sanitizedName || sanitizedPrice <= 0) {
      Alert.alert('Validation', 'Item name and price must be valid');
      return;
    }

    const updatedItems = data.items.map(i =>
      i.id === item.id
        ? { ...item, name: sanitizedName, quantity: sanitizedQuantity, price: sanitizedPrice }
        : i
    );
    const totals = calculateTotals(updatedItems);
    setData({
      ...data,
      items: updatedItems,
      subtotal: totals.subtotal,
      total: totals.total,
    });
    setEditingItemId(null);
    setEditingItem(null);
  };

  // Delete item
  const handleDeleteItem = (id?: string) => {
    if (!id) return;
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => {
            const updatedItems = data.items.filter(i => i.id !== id);
            const totals = calculateTotals(updatedItems);
            setData({
              ...data,
              items: updatedItems,
              subtotal: totals.subtotal,
              total: totals.total,
            });
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Add new item
  const handleAddItem = () => {
    const sanitizedName = newItem.name.trim();
    const sanitizedQuantity = Number.isFinite(newItem.quantity) ? Math.max(1, Math.trunc(newItem.quantity)) : 1;
    const sanitizedPrice = Number.isFinite(newItem.price) ? Math.max(0, newItem.price) : 0;

    if (!sanitizedName || sanitizedPrice <= 0) {
      Alert.alert('Error', 'Please enter item name and price');
      return;
    }

    const item: ReceiptItem = {
      id: `item_${Date.now()}`,
      name: sanitizedName,
      quantity: sanitizedQuantity,
      price: sanitizedPrice,
    };

    const updatedItems = [...data.items, item];
    const totals = calculateTotals(updatedItems);
    setData({
      ...data,
      items: updatedItems,
      subtotal: totals.subtotal,
      total: totals.total,
    });

    setNewItem({ name: '', quantity: 1, price: 0 });
    setShowAddItem(false);
  };

  // Update tax
  const handleUpdateTax = (value: string) => {
    const tax = parseFloat(value) || 0;
    const totals = calculateTotals(data.items);
    setData({
      ...data,
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat((totals.subtotal + tax + data.service_charge).toFixed(2)),
    });
  };

  // Update service charge
  const handleUpdateServiceCharge = (value: string) => {
    const charge = parseFloat(value) || 0;
    const totals = calculateTotals(data.items);
    setData({
      ...data,
      service_charge: parseFloat(charge.toFixed(2)),
      total: parseFloat((totals.subtotal + data.tax + charge).toFixed(2)),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/scan-receipt')}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Receipt</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Crop Mode View */}
        {showCropMode && data.image_uri ? (
          imageDimensions.width > 0 && imageDimensions.height > 0 ? (
            <ReceiptCropper
              imageUri={data.image_uri}
              imageWidth={imageDimensions.width}
              imageHeight={imageDimensions.height}
              initialPoints={cropSuggestion}
              initialPointsVersion={cropSuggestionVersion}
              disabled={isRescanning}
              onCancel={() => {
                cropSuggestionRequestRef.current = 0;
                setShowCropMode(false);
              }}
              onConfirm={handleRescanCropped}
            />
          ) : (
            <View style={styles.cropLoadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.cropLoadingText}>Preparing crop editor...</Text>
            </View>
          )
        ) : (
          /* Normal Review Mode */
          <>
            {/* Receipt Image Preview */}
            {data.image_uri && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: data.image_uri }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  onPress={openCropMode}
                  style={styles.cropImageButton}
                >
                  <MaterialCommunityIcons name="crop" size={20} color={Colors.primaryForeground} />
                  <Text style={styles.cropImageButtonText}>Crop & Rescan</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* OCR Confidence Badge */}
              <View style={styles.section}>
                <View style={styles.confidenceBadge}>
                  <MaterialCommunityIcons
                    name={data.confidence > 0.8 ? 'check-circle' : 'alert-circle'}
                    size={20}
                    color={data.confidence > 0.8 ? Colors.success : Colors.warning}
                  />
                  <Text style={styles.confidenceText}>
                    OCR Confidence: {(data.confidence * 100).toFixed(0)}%
                  </Text>
                </View>

                {data.confidence < 0.8 && (
                  <View style={styles.lowConfidenceWarning}>
                    <MaterialCommunityIcons name="alert" size={16} color={Colors.error} />
                    <Text style={styles.warningText}>
                      Low confidence - please review and edit items
                    </Text>
                  </View>
                )}

                {hasParsingWarning && (
                  <View style={styles.lowConfidenceWarning}>
                    <MaterialCommunityIcons name="alert-octagon" size={16} color={Colors.error} />
                    <Text style={styles.warningText}>
                      OCR totals may be inconsistent. Please verify subtotal, tax, and total.
                    </Text>
                  </View>
                )}

                {hasTaxAmbiguousWarning && (
                  <View style={styles.lowConfidenceWarning}>
                    <MaterialCommunityIcons name="alert-decagram" size={16} color={Colors.warning} />
                    <Text style={styles.warningText}>
                      Tax value looks ambiguous for IDR receipt. Please confirm tax manually.
                    </Text>
                  </View>
                )}
              </View>

              {/* Currency selector */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Currency</Text>
                <View style={styles.currencySelector}>
                  <MaterialCommunityIcons name="currency-usd" size={20} color={Colors.primary} />
                  <Text style={styles.currencyText}>{data.currency}</Text>
                </View>
              </View>

              {/* Items section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Items ({data.items.length})</Text>
                  <TouchableOpacity
                    onPress={() => setShowAddItem(true)}
                    style={styles.addButton}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                {data.items.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons
                      name="inbox-multiple-outline"
                      size={40}
                      color={Colors.muted}
                    />
                    <Text style={styles.emptyText}>No items added yet</Text>
                    <Text style={styles.emptySubtext}>
                      Add items to create your bill
                    </Text>
                  </View>
                ) : (
                  <View style={styles.itemsList}>
                    {data.items.map((item, idx) => (
                      <View key={item.id || idx} style={styles.itemCard}>
                        {/* Confidence indicator */}
                        {item.confidence && item.confidence < 0.7 && (
                          <View style={styles.lowConfidenceTag}>
                            <MaterialCommunityIcons
                              name="alert"
                              size={12}
                              color={Colors.error}
                            />
                            <Text style={styles.lowConfidenceTagText}>
                              Low confidence
                            </Text>
                          </View>
                        )}

                        <TouchableOpacity
                          onPress={() => {
                            const itemId = item.id || `item_${idx}`;
                            setEditingItemId(itemId);
                            setEditingItem({ ...item, id: itemId });
                          }}
                          style={styles.itemContent}
                        >
                          <View style={styles.itemInfo}>
                            <Text
                              style={[
                                styles.itemName,
                                ...(item.confidence && item.confidence < 0.7 ? [styles.lowConfidenceText] : []),
                              ]}
                            >
                              {item.name}
                            </Text>
                            <View style={styles.itemQuantity}>
                              <Text style={styles.quantityText}>
                                {item.quantity}x @ {data.currency} {item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.itemTotal}>
                            <Text style={styles.itemTotalAmount}>
                              {(item.quantity * item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleDeleteItem(item.id)}
                          style={styles.deleteButton}
                        >
                          <MaterialCommunityIcons name="delete" size={20} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Tax & Service Charge */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Charges</Text>

                <View style={styles.chargeCard}>
                  <View style={styles.chargeInput}>
                    <Text style={styles.chargeLabel}>Tax</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={data.tax.toString()}
                        onChangeText={handleUpdateTax}
                        placeholder="0.00"
                      />
                      <Text style={styles.currencyDot}>{data.currency}</Text>
                    </View>
                  </View>

                  <View style={styles.chargeInput}>
                    <Text style={styles.chargeLabel}>Service Charge</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={data.service_charge.toString()}
                        onChangeText={handleUpdateServiceCharge}
                        placeholder="0.00"
                      />
                      <Text style={styles.currencyDot}>{data.currency}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>{data.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax</Text>
                  <Text style={styles.summaryValue}>{data.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service</Text>
                  <Text style={styles.summaryValue}>{data.service_charge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{data.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => router.push('/scan-receipt')}
                style={styles.secondaryButton}
              >
                <MaterialCommunityIcons name="close" size={20} color={Colors.text} />
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleConfirmReceipt}
                disabled={isSaving}
                style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.primaryForeground} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color={Colors.primaryForeground} />
                    <Text style={styles.primaryButtonText}>Confirm & Create Bill</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Edit Item Modal */}
        <Modal visible={!!editingItemId} transparent animationType="slide">
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditingItemId(null)}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent}>
              {editingItem && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Item Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editingItem.name}
                      onChangeText={(text) =>
                        setEditingItem({ ...editingItem, name: text })
                      }
                      placeholder="Enter item name"
                    />
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.formLabel}>Quantity</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="decimal-pad"
                        value={editingItem.quantity.toString()}
                        onChangeText={(text) =>
                          setEditingItem({
                            ...editingItem,
                            quantity: parseInt(text) || 1,
                          })
                        }
                        placeholder="1"
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                      <Text style={styles.formLabel}>Price ({data.currency})</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="decimal-pad"
                        value={editingItem.price.toString()}
                        onChangeText={(text) =>
                          setEditingItem({
                            ...editingItem,
                            price: parseFloat(text) || 0,
                          })
                        }
                        placeholder="0.00"
                      />
                    </View>
                  </View>

                  <View style={styles.subtotalBox}>
                    <Text style={styles.subtotalLabel}>Subtotal</Text>
                    <Text style={styles.subtotalValue}>
                      {data.currency} {(editingItem.quantity * editingItem.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditingItemId(null)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => editingItem && handleUpdateItem(editingItem)}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Add Item Modal */}
        <Modal visible={showAddItem} transparent animationType="slide">
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddItem(false)}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Item</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Item Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={newItem.name}
                  onChangeText={(text) =>
                    setNewItem({ ...newItem, name: text })
                  }
                  placeholder="Enter item name"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Quantity</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                    value={newItem.quantity.toString()}
                    onChangeText={(text) =>
                      setNewItem({
                        ...newItem,
                        quantity: parseInt(text) || 1,
                      })
                    }
                    placeholder="1"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.formLabel}>Price ({data.currency})</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                    value={newItem.price.toString()}
                    onChangeText={(text) =>
                      setNewItem({
                        ...newItem,
                        price: parseFloat(text) || 0,
                      })
                    }
                    placeholder="0.00"
                  />
                </View>
              </View>

              <View style={styles.subtotalBox}>
                <Text style={styles.subtotalLabel}>Subtotal</Text>
                <Text style={styles.subtotalValue}>
                  {data.currency} {(newItem.quantity * newItem.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowAddItem(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddItem}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
  },
  cropLoadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cropLoadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  // Image preview
  imagePreviewContainer: {
    height: 220,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  cropImageButton: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cropImageButtonText: {
    color: Colors.primaryForeground,
    fontWeight: '600',
    fontSize: 14,
  },
  // Confidence badge
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  lowConfidenceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.error + '15',
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.error + '55',
  },
  warningText: {
    fontSize: 14,
    color: Colors.error,
    flex: 1,
  },
  lowConfidenceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.error + '15',
    borderRadius: 8,
    gap: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.error + '55',
  },
  lowConfidenceTagText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '600',
  },
  lowConfidenceText: {
    color: Colors.warning,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  section: {
    marginBottom: 18,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemInfo: {
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  itemQuantity: {
    marginTop: 4,
  },
  quantityText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  itemTotal: {
    alignItems: 'flex-end',
  },
  itemTotalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chargeCard: {
    gap: 12,
  },
  chargeInput: {
    gap: 6,
  },
  chargeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  currencyDot: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginLeft: 4,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryButton: {
    flex: 1.25,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryForeground,
  },
  secondaryButton: {
    flex: 0.95,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  textInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.text,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  subtotalBox: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
});
