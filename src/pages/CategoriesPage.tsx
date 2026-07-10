import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Category } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { PageLoader } from '../components/Loading';
import { useFormValidation, validators } from '../hooks/useFormValidation';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';

export default function CategoriesPage() {
  const { isManagerOrAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useFormValidation(
    { name: '', description: '', color: '#3B82F6' },
    {
      name: [validators.required('Nazwa kategorii jest wymagana'), validators.maxLength(50, 'Maksimum 50 znaków')],
      description: [validators.maxLength(200, 'Maksimum 200 znaków')],
    }
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order');
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(category?: Category) {
    if (category) {
      setEditingCategory(category);
      form.setValues({
        name: category.name,
        description: category.description || '',
        color: category.color || '#3B82F6'
      });
    } else {
      setEditingCategory(null);
      form.reset();
    }
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      if (editingCategory) {
        await supabase
          .from('categories')
          .update({
            name: form.values.name.trim(),
            description: form.values.description.trim() || null,
            color: form.values.color
          })
          .eq('id', editingCategory.id);
      } else {
        await supabase
          .from('categories')
          .insert({
            name: form.values.name.trim(),
            description: form.values.description.trim() || null,
            color: form.values.color,
            sort_order: categories.length + 1
          });
      }
      setShowModal(false);
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć tę kategorię?')) return;
    try {
      await supabase.from('categories').update({ is_active: false }).eq('id', id);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kategorie</h1>
          <p className="text-gray-500 text-sm mt-1">Kategorie sprzętu firmowego</p>
        </div>
        {isManagerOrAdmin && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => openModal()}>
            Dodaj kategorię
          </Button>
        )}
      </div>

      <Card padding="none">
        {categories.filter(c => c.is_active).length === 0 ? (
          <EmptyState
            icon={<Tag className="w-8 h-8 text-gray-400" />}
            title="Brak kategorii"
            description="Dodaj pierwszą kategorię sprzętu"
          />
        ) : (
          <div className="divide-y divide-gray-200">
            {categories.filter(c => c.is_active).map((category) => (
              <div key={category.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: category.color ? `${category.color}20` : '#f3f4f6' }}
                  >
                    <Tag className="w-5 h-5" style={{ color: category.color || '#6b7280' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{category.name}</p>
                    {category.description && (
                      <p className="text-xs text-gray-500">{category.description}</p>
                    )}
                  </div>
                </div>
                {isManagerOrAdmin && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" icon={<Edit className="w-4 h-4" />} onClick={() => openModal(category)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => handleDelete(category.id)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingCategory ? 'Edytuj kategorię' : 'Nowa kategoria'}>
        <div className="p-6 space-y-4">
          <Input
            label="Nazwa"
            required
            value={form.values.name}
            onChange={(e) => form.handleChange('name', e.target.value)}
            onBlur={() => form.handleBlur('name')}
            error={form.touched.name ? form.errors.name : undefined}
            placeholder="np. Laptopy"
          />
          <Input
            label="Opis"
            value={form.values.description}
            onChange={(e) => form.handleChange('description', e.target.value)}
            onBlur={() => form.handleBlur('description')}
            error={form.touched.description ? form.errors.description : undefined}
            placeholder="Opis kategorii"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Kolor</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.values.color}
                onChange={(e) => form.handleChange('color', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer"
                aria-label="Color"
              />
              <div
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: `${form.values.color}20`, color: form.values.color }}
              >
                Podgląd
              </div>
            </div>
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
