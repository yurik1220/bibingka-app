import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiFetch from '../api/client';

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    try {
      setError(null);
      const result = await apiFetch('/products');
      setProducts(result);
    } catch (err) {
      setError(err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProducts().finally(() => setLoading(false));
    }, [])
  );

  const handleAddProduct = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Missing info', 'Name and price are required.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          price: Number(price),
          daily_limit: dailyLimit ? Number(dailyLimit) : null,
        }),
      });
      setName('');
      setPrice('');
      setDailyLimit('');
      await loadProducts();
    } catch (err) {
      Alert.alert('Failed to add product', err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (product) => {
    try {
      await apiFetch(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_available: !product.is_available }),
      });
      await loadProducts();
    } catch (err) {
      Alert.alert('Failed to update', err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Add Product</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Product name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Price"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Daily limit (optional)"
          value={dailyLimit}
          onChangeText={setDailyLimit}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddProduct}
          disabled={saving}
        >
          <Text style={styles.addButtonText}>
            {saving ? 'Adding...' : 'Add Product'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>Couldn't load products: {error}</Text>}

      <Text style={styles.sectionTitle}>Menu</Text>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productRow}
            onPress={() => toggleAvailability(item)}
          >
            <View>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productMeta}>
                ₱{item.price}
                {item.daily_limit ? ` · limit ${item.daily_limit}/day` : ''}
              </Text>
            </View>
            <Text style={item.is_available ? styles.available : styles.unavailable}>
              {item.is_available ? 'Available' : 'Unavailable'}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No products yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#c0392b', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, marginTop: 8 },
  form: { marginBottom: 16, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
  },
  addButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  productName: { fontSize: 15, fontWeight: '600' },
  productMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  available: { color: '#2e7d32', fontWeight: 'bold' },
  unavailable: { color: '#999', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 24 },
});