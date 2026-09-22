import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiFetch from '../api/client';

const STATUS_COLORS = {
  pending_payment: '#e67e22',
  confirmed: '#27ae60',
  preparing: '#2980b9',
  ready: '#8e44ad',
  completed: '#7f8c8d',
  cancelled: '#c0392b',
  needs_review: '#c0392b',
};

const STATUS_LABELS = {
  pending_payment: 'Pending Payment',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
  needs_review: 'Needs Review',
};

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadOrders = async () => {
    try {
      setError(null);
      const query = filter === 'all' ? '' : `?status=${filter}`;
      const result = await apiFetch(`/orders${query}`);
      setOrders(result);
    } catch (err) {
      setError(err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrders().finally(() => setLoading(false));
    }, [filter])
  );

  const filters = ['all', 'pending_payment', 'confirmed', 'preparing', 'ready', 'completed'];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filters}
        keyExtractor={(item) => item}
        style={styles.filterBar}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item && styles.filterChipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterChipText, filter === item && styles.filterChipTextActive]}>
              {item === 'all' ? 'All' : STATUS_LABELS[item]}
            </Text>
          </TouchableOpacity>
        )}
      />

      {error && <Text style={styles.errorText}>Couldn't load orders: {error}</Text>}

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.orderCard}
            onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
          >
            <View style={styles.orderHeader}>
              <Text style={styles.orderNumber}>#{item.id}</Text>
              <Text style={[styles.statusBadge, { color: STATUS_COLORS[item.status] }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.orderMeta}>
              {item.fulfillment_type === 'delivery' ? 'Delivery' : 'Pickup'}
              {'  -  '}
              {item.pickup_date} {item.pickup_time}
            </Text>
            <Text style={styles.orderTotal}>Total: PHP {item.total_amount}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No orders here.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#c0392b', padding: 16 },
  filterBar: { flexGrow: 0, paddingHorizontal: 12, paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#2e7d32' },
  filterChipText: { color: '#333', fontSize: 13 },
  filterChipTextActive: { color: '#fff', fontWeight: 'bold' },
  orderCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderNumber: { fontWeight: 'bold', fontSize: 15 },
  statusBadge: { fontWeight: 'bold', fontSize: 12 },
  customerName: { fontSize: 15, marginBottom: 2 },
  orderMeta: { fontSize: 13, color: '#666', marginBottom: 4 },
  orderTotal: { fontSize: 14, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
});