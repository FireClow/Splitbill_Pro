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
  
  const scannedData = params.scannedData
    ? JSON.parse(params.scannedData as string)
    : null;

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
    if (data.items.length === 0) {
      Alert.alert('Validation', 'Please add at least one item');
      return;
    }

    try {
      setIsSaving(true);

      // Save to database via backend
      const payload = {
        image_id: data.image_id,
        currency: data.currency,
        items: data.items,
        subtotal: data.subtotal,
        tax: data.tax,
        service_charge: data.service_charge,
        total: data.total,
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
            receiptData: JSON.stringify({
              ...data,
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
    const updatedItems = data.items.map(i =>
      i.id === item.id ? item : i
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
    if (!newItem.name || newItem.price <= 0) {
      Alert.alert('Error', 'Please enter item name and price');
      return;
    }

    const item: ReceiptItem = {
      id: `item_${Date.now()}`,
      name: newItem.name,
      quantity: newItem.quantity || 1,
      price: newItem.price,
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
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
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
              <ActivityIndicator size="large" color="#3B82F6" />
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
                  <MaterialCommunityIcons name="crop" size={20} color="white" />
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
                    color={data.confidence > 0.8 ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={styles.confidenceText}>
                    OCR Confidence: {(data.confidence * 100).toFixed(0)}%
                  </Text>
                </View>

                {data.confidence < 0.8 && (
                  <View style={styles.lowConfidenceWarning}>
                    <MaterialCommunityIcons name="alert" size={16} color="#DC2626" />
                    <Text style={styles.warningText}>
                      Low confidence - please review and edit items
                    </Text>
                  </View>
                )}
              </View>

              {/* Currency selector */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Currency</Text>
                <View style={styles.currencySelector}>
                  <MaterialCommunityIcons name="currency-usd" size={20} color="#3B82F6" />
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
                    <MaterialCommunityIcons name="plus" size={20} color="#3B82F6" />
                  </TouchableOpacity>
                </View>

                {data.items.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons
                      name="inbox-multiple-outline"
                      size={40}
                      color="#CBD5E1"
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
                              color="#DC2626"
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
                          <MaterialCommunityIcons name="delete" size={20} color="#EF4444" />
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
                <MaterialCommunityIcons name="close" size={20} color="#3B82F6" />
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleConfirmReceipt}
                disabled={isSaving}
                style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="white" />
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
                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
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
                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  cropLoadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cropLoadingText: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  // Image preview
  imagePreviewContainer: {
    height: 200,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  cropImageButton: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    gap: 6,
  },
  cropImageButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // Confidence badge
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  lowConfidenceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
  lowConfidenceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    gap: 4,
    marginBottom: 8,
  },
  lowConfidenceTagText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  lowConfidenceText: {
    color: '#DC2626',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  section: {
    marginBottom: 20,
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
    color: '#0F172A',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
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
    color: '#0F172A',
  },
  itemQuantity: {
    marginTop: 4,
  },
  quantityText: {
    fontSize: 12,
    color: '#64748B',
  },
  itemTotal: {
    alignItems: 'flex-end',
  },
  itemTotalAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
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
    color: '#0F172A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  currencyDot: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 4,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  modal: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  textInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    color: '#0F172A',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  subtotalBox: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
});
