import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Location } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { PageLoader } from '../components/Loading';
import { useFormValidation, validators } from '../hooks/useFormValidation';
import { Plus, Edit, Trash2, MapPin, Building, Package, Monitor, Laptop, Smartphone, Printer, Wrench, Sofa, Home, Warehouse } from 'lucide-react';

interface LocationWithAssets extends Location {
  assetCount: number;
  totalValue: number;
  assetsByCategory: { category: string; count: number; color: string }[];
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  'Laptop': { icon: <Laptop className="w-4 h-4" />, color: '#3b82f6' },
  'Monitor': { icon: <Monitor className="w-4 h-4" />, color: '#8b5cf6' },
  'Telefon': { icon: <Smartphone className="w-4 h-4" />, color: '#10b981' },
  'Tablet': { icon: <Smartphone className="w-4 h-4" />, color: '#f59e0b' },
  'Drukarka': { icon: <Printer className="w-4 h-4" />, color: '#6366f1' },
  'Komputer': { icon: <Monitor className="w-4 h-4" />, color: '#ec4899' },
  'Akcesoria': { icon: <Wrench className="w-4 h-4" />, color: '#14b8a6' },
  'Meble': { icon: <Sofa className="w-4 h-4" />, color: '#f97316' },
  'Narzędzia': { icon: <Wrench className="w-4 h-4" />, color: '#84cc16' },
  'Inne': { icon: <Package className="w-4 h-4" />, color: '#6b7280' }
};

function getLocationIcon(name: string) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('home') || nameLower.includes('home office') || nameLower.includes('praca zdalna')) {
    return { icon: <Home className="w-6 h-6" />, bg: 'bg-amber-100', color: 'text-amber-600' };
  }
  if (nameLower.includes('magazyn') || nameLower.includes('warehouse') || nameLower.includes('skład')) {
    return { icon: <Warehouse className="w-6 h-6" />, bg: 'bg-orange-100', color: 'text-orange-600' };
  }
  return { icon: <Building className="w-6 h-6" />, bg: 'bg-emerald-100', color: 'text-emerald-600' };
}

export default function LocationsPage() {
  const { isManagerOrAdmin, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationWithAssets[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useFormValidation(
    { name: '', address: '', city: '', country: 'Poland' },
    {
      name: [validators.required('Nazwa lokalizacji jest wymagana'), validators.maxLength(100, 'Maksimum 100 znaków')],
      address: [validators.maxLength(200, 'Maksimum 200 znaków')],
      city: [validators.maxLength(100, 'Maksimum 100 znaków')],
      country: [validators.required('Kraj jest wymagany'), validators.maxLength(100, 'Maksimum 100 znaków')],
    }
  );

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [locRes, assetsRes] = await Promise.all([
        supabase.from('locations').select('*').order('name'),
        supabase.from('assets').select('*, category:categories(*)').eq('is_active', true),
      ]);

      const locationsData = locRes.data || [];
      const assetsData = assetsRes.data || [];

      const locationsWithAssets = locationsData.map(loc => {
        const locAssets = assetsData.filter(a => a.location_id === loc.id);
        const assetCount = locAssets.length;
        const totalValue = locAssets.reduce((sum, a) => sum + (a.purchase_price || 0), 0);

        const categoryMap = new Map<string, { count: number; color: string }>();
        locAssets.forEach(asset => {
          const catName = asset.category?.name || 'Inne';
          const catColor = asset.category?.color || categoryConfig[catName]?.color || '#6b7280';
          const existing = categoryMap.get(catName);
          if (existing) {
            existing.count++;
          } else {
            categoryMap.set(catName, { count: 1, color: catColor });
          }
        });

        const assetsByCategory = Array.from(categoryMap.entries())
          .map(([category, data]) => ({ category, count: data.count, color: data.color }))
          .sort((a, b) => b.count - a.count);

        return { ...loc, assetCount, totalValue, assetsByCategory };
      });

      setLocations(locationsWithAssets);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(location?: Location) {
    if (location) {
      setEditingLocation(location);
      form.setValues({
        name: location.name,
        address: location.address || '',
        city: location.city || '',
        country: location.country
      });
    } else {
      setEditingLocation(null);
      form.reset();
    }
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      const data = {
        name: form.values.name.trim(),
        address: form.values.address.trim() || null,
        city: form.values.city.trim() || null,
        country: form.values.country
      };

      if (editingLocation) {
        await supabase.from('locations').update(data).eq('id', editingLocation.id);
      } else {
        await supabase.from('locations').insert(data);
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving location:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć tę lokalizację?')) return;
    try {
      await supabase.from('locations').update({ is_active: false }).eq('id', id);
      fetchData();
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  }

  if (loading) return <PageLoader />;

  const activeLocations = locations.filter(l => l.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lokalizacje</h1>
          <p className="text-gray-500 text-sm mt-1">Lokalizacje biur i magazynów</p>
        </div>
        {isManagerOrAdmin && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => openModal()}>
            Dodaj lokalizację
          </Button>
        )}
      </div>

      {activeLocations.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MapPin className="w-8 h-8 text-gray-400" />}
            title="Brak lokalizacji"
            description="Dodaj pierwszą lokalizację"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeLocations.map((location) => {
            const locStyle = getLocationIcon(location.name);
            return (
              <Card key={location.id} className="flex flex-col">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg ${locStyle.bg} flex items-center justify-center`}>
                      <span className={locStyle.color}>{locStyle.icon}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{location.name}</p>
                      {location.address && <p className="text-sm text-gray-500">{location.address}</p>}
                      {location.city && !location.address && <p className="text-sm text-gray-500">{location.city}</p>}
                    </div>
                  </div>
                  {isManagerOrAdmin && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="w-4 h-4" />} onClick={() => openModal(location)} />
                      {isAdmin && (
                        <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => handleDelete(location.id)} />
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">
                      {location.assetCount} {location.assetCount === 1 ? 'sztuka' : location.assetCount < 5 ? 'sztuki' : 'sztuk'}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {location.totalValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </span>
                  </div>

                  {location.assetsByCategory.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {location.assetsByCategory.map(({ category, count, color }) => {
                        const config = categoryConfig[category] || categoryConfig['Inne'];
                        return (
                          <div key={category} className="flex items-center gap-1 cursor-help" title={`${category}: ${count}`}>
                            <span style={{ color }}>{config.icon}</span>
                            <span className="text-sm font-medium" style={{ color }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingLocation ? 'Edytuj lokalizację' : 'Nowa lokalizacja'}>
        <div className="p-6 space-y-4">
          <Input
            label="Nazwa"
            required
            value={form.values.name}
            onChange={(e) => form.handleChange('name', e.target.value)}
            onBlur={() => form.handleBlur('name')}
            error={form.touched.name ? form.errors.name : undefined}
            placeholder="np. Warszawa HQ, Magazyn, Home Office"
          />
          <Input
            label="Adres"
            value={form.values.address}
            onChange={(e) => form.handleChange('address', e.target.value)}
            onBlur={() => form.handleBlur('address')}
            error={form.touched.address ? form.errors.address : undefined}
            placeholder="ul. Przykładowa 1"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Miasto"
              value={form.values.city}
              onChange={(e) => form.handleChange('city', e.target.value)}
              onBlur={() => form.handleBlur('city')}
              error={form.touched.city ? form.errors.city : undefined}
              placeholder="Warszawa"
            />
            <Input
              label="Kraj"
              required
              value={form.values.country}
              onChange={(e) => form.handleChange('country', e.target.value)}
              onBlur={() => form.handleBlur('country')}
              error={form.touched.country ? form.errors.country : undefined}
              placeholder="Poland"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>Anuluj</Button>
            <Button onClick={handleSave} loading={saving}>Zapisz</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
