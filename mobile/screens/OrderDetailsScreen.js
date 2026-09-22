import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiFetch from '../api/client';

const STATUS_FLOW = ['pending_payment', 'confirmed', 'preparing', 'ready', 'completed'];

const STATUS_LABELS = {
  pending_payment: 'Pending Payment',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
  needs_review: 'Needs Review',
};

export default function OrderDetailsScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  const loadOrder = async () => {
    try {
      setError(null);
      const result = await apiFetch(`/orders/${orderId}`);
      setOrder(result);
    } catch (err) {
      setError(err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrder().finally(() => setLoading(false));
    }, [orderId])
  );

  const handleVerifyPayment = async () => {
    if (!order.payment) return;
    setUpdating(true);
    try {
      await apiFetch(`/payments/${order.payment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'verified' }),
      });
      await loadOrder();
    } catch (err) {
      Alert.alert('Failed to verify payment', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleAdvanceStatus = async () => {
    const currentIndex = STATUS_FLOW.indexOf(order.status);
    const nextStatus = STATUS_FLOW[currentIndex + 1];
    if (!nextStatus) return;

    setUpdating(true);
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadOrder();
    } catch (err) {
      Alert.alert('Failed to update status', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel order?', 'This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setUpdating(true);
          try {
            await apiFetch(`/orders/${orderId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'cancelled' }),
            });
            navigation.goBack();
          } catch (err) {
            Alert.alert('Failed to cancel', err.message);
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load order: {error}</Text>
      </View>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(order.status);
  const nextStatus = STATUS_FLOW[currentIndex + 1];
  const canAdvance = currentIndex !== -1 && nextStatus;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.orderNumber}>Order #{order.id}</Text>
      <Text style={styles.statusText}>{STATUS_LABELS[order.status]}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <Text style={styles.line}>{order.customer_name}</Text>
        {order.customer_phone && <Text style={styles.line}>{order.customer_phone}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {order.fulfillment_type === 'delivery' ? 'Delivery' : 'Pickup'}
        </Text>
        <Text style={styles.line}>{order.pickup_date}  {order.pickup_time}</Text>
        {order.fulfillment_type === 'delivery' && order.delivery_address && (
          <Text style={styles.line}>{order.delivery_address}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.line}>{item.quantity} x {item.product_name}</Text>
            <Text style={styles.line}>PHP {item.subtotal}</Text>
          </View>
        ))}
        <View style={styles.itemRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalLabel}>PHP {order.total_amount}</Text>
        </View>
      </View>

      {order.payment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <Text style={styles.line}>
            {order.payment.method.toUpperCase()} - {order.payment.status}
          </Text>
        </View>
      )}

      {order.customer_note && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note</Text>
          <Text style={styles.line}>{order.customer_note}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {order.payment && order.payment.status === 'pending' && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleVerifyPayment}
            disabled={updating}
          >
            <Text style={styles.primaryButtonText}>Verify Payment</Text>
          </TouchableOpacity>
        )}

        {canAdvance && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAdvanceStatus}
            disabled={updating}
          >
            <Text style={styles.primaryButtonText}>
              Mark as {STATUS_LABELS[nextStatus]}
            </Text>
          </TouchableOpacity>
        )}

        {order.status !== 'cancelled' && order.status !== 'completed' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={updating}
          >
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#c0392b', textAlign: 'center', paddingHorizontal: 24 },
  orderNumber: { fontSize: 20, fontWeight: 'bold' },
  statusText: { fontSize: 14, color: '#666', marginBottom: 16 },
  section: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#999', marginBottom: 6, textTransform: 'uppercase' },
  line: { fontSize: 15, marginBottom: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontSize: 15, fontWeight: 'bold' },
  actions: { gap: 10, marginTop: 8, marginBottom: 32 },
  primaryButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#c0392b', fontWeight: 'bold' },
});