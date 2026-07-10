import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Category, Location, Status, Employee, Supplier, Document } from '../lib/types';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import { PageLoader } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import { useFormValidation, validators } from '../hooks/useFormValidation';
import { ArrowLeft, Save, Upload, X, FileText, Image, Trash2, AlertCircle } from 'lucide-react';

export default function AssetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [images, setImages] = useState<Document[]>([]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const form = useFormValidation(
    {
      name: '', category_id: '', manufacturer: '', model: '',
      serial_number: '', asset_tag: '', inventory_number: '',
      purchase_date: '', purchase_price: '', warranty_months: '',
      location_id: '', status_id: '', assigned_to: '', supplier_id: '',
      description: '', notes: ''
    },
    {
      name: [validators.required('Nazwa jest wymagana'), validators.maxLength(200, 'Nazwa nie może przekraczać 200 znaków')],
      serial_number: [validators.maxLength(100, 'Maksimum 100 znaków')],
      inventory_number: [validators.maxLength(100, 'Maksimum 100 znaków')],
      asset_tag: [validators.maxLength(100, 'Maksimum 100 znaków')],
      purchase_price: [validators.price('Podaj prawidłową kwotę (np. 1500.00)')],
      warranty_months: [validators.number('Podaj liczbę miesięcy'), validators.positiveNumber('Liczba miesięcy musi być dodatnia')],
      purchase_date: [validators.date('Podaj prawidłową datę'), validators.dateNotFuture('Data zakupu nie może być w przyszłości')],
      description: [validators.maxLength(2000, 'Opis nie może przekraczać 2000 znaków')],
      notes: [validators.maxLength(1000, 'Uwagi nie mogą przekraczać 1000 znaków')],
    }
  );

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('locations').select('*').eq('is_active', true).order('name'),
      supabase.from('statuses').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('employees').select('*').eq('is_active', true).order('first_name'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name')
    ]).then(([catRes, locRes, statRes, empRes, supRes]) => {
      setCategories(catRes.data || []);
      setLocations(locRes.data || []);
      setStatuses(statRes.data || []);
      setEmployees(empRes.data || []);
      setSuppliers(supRes.data || []);

      if (isNew) {
        const orderedStatus = statRes.data?.find(s => s.name === 'Zamówione');
        const availableStatus = statRes.data?.find(s => s.name === 'Dostępny');
        form.setFieldValue('status_id', orderedStatus?.id || availableStatus?.id || '');
      }
    });

    if (id) fetchAsset();
    else setLoading(false);
  }, [id]);

  async function fetchAsset() {
    try {
      const [assetRes, docsRes] = await Promise.all([
        supabase.from('assets').select('*').eq('id', id).maybeSingle(),
        supabase.from('documents').select('*').eq('asset_id', id)
      ]);

      if (assetRes.error) throw assetRes.error;
      if (assetRes.data) {
        form.setValues({
          name: assetRes.data.name || '',
          category_id: assetRes.data.category_id || '',
          manufacturer: assetRes.data.manufacturer || '',
          model: assetRes.data.model || '',
          serial_number: assetRes.data.serial_number || '',
          asset_tag: assetRes.data.asset_tag || '',
          inventory_number: assetRes.data.inventory_number || '',
          purchase_date: assetRes.data.purchase_date || '',
          purchase_price: assetRes.data.purchase_price?.toString() || '',
          warranty_months: assetRes.data.warranty_months?.toString() || '',
          location_id: assetRes.data.location_id || '',
          status_id: assetRes.data.status_id || '',
          assigned_to: assetRes.data.assigned_to || '',
          supplier_id: assetRes.data.supplier_id || '',
          description: assetRes.data.description || '',
          notes: assetRes.data.notes || ''
        });

        const docs = docsRes.data || [];
        setImages(docs.filter(d => d.type === 'image'));
        setDocuments(docs.filter(d => d.type === 'document'));
      }
    } catch (error) {
      console.error('Error fetching asset:', error);
      setSubmitError('Nie udało się pobrać danych sprzętu.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !id) return;

    setUploadingImage(true);
    try {
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/images/${Date.now()}.${fileExt}`;
      const filePath = `assets/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('documents')
        .insert({ asset_id: id, name: file.name, type: 'image', file_path: filePath, mime_type: file.type, file_size: file.size })
        .select().single();

      if (error) throw error;
      if (data) setImages(prev => [...prev, data]);
    } catch (error) {
      console.error('Error uploading image:', error);
      setSubmitError('Błąd podczas przesyłania zdjęcia');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !id) return;

    setUploadingDoc(true);
    try {
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/docs/${Date.now()}.${fileExt}`;
      const filePath = `assets/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('documents')
        .insert({ asset_id: id, name: file.name, type: 'document', file_path: filePath, mime_type: file.type, file_size: file.size })
        .select().single();

      if (error) throw error;
      if (data) setDocuments(prev => [...prev, data]);
    } catch (error) {
      console.error('Error uploading document:', error);
      setSubmitError('Błąd podczas przesyłania dokumentu');
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  }

  async function handleDeleteDocument(docId: string, filePath: string, type: 'image' | 'document') {
    if (!confirm('Czy na pewno chcesz usunąć ten plik?')) return;
    try {
      await supabase.storage.from('documents').remove([filePath]);
      await supabase.from('documents').delete().eq('id', docId);
      if (type === 'image') setImages(prev => prev.filter(d => d.id !== docId));
      else setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!form.validateAll()) {
      setSubmitError('Uzupełnij wymagane pola i popraw błędy w formularzu.');
      return;
    }

    setSaving(true);
    try {
      const warrantyMonths = form.values.warranty_months ? parseInt(form.values.warranty_months) : null;
      const purchaseDate = form.values.purchase_date || null;

      let warrantyEndDate = null;
      if (warrantyMonths && purchaseDate) {
        const purchase = new Date(purchaseDate);
        warrantyEndDate = new Date(purchase.setMonth(purchase.getMonth() + warrantyMonths)).toISOString().split('T')[0];
      }

      const assetData = {
        name: form.values.name.trim(),
        category_id: form.values.category_id || null,
        manufacturer: form.values.manufacturer.trim() || null,
        model: form.values.model.trim() || null,
        serial_number: form.values.serial_number.trim() || null,
        asset_tag: form.values.asset_tag.trim() || null,
        inventory_number: form.values.inventory_number.trim() || null,
        purchase_date: purchaseDate,
        purchase_price: form.values.purchase_price ? parseFloat(form.values.purchase_price.replace(',', '.')) : null,
        warranty_months: warrantyMonths,
        warranty_end_date: warrantyEndDate,
        location_id: form.values.location_id || null,
        status_id: form.values.status_id || null,
        assigned_to: form.values.assigned_to || null,
        supplier_id: form.values.supplier_id || null,
        description: form.values.description.trim() || null,
        notes: form.values.notes.trim() || null,
        created_by: isNew ? user?.id : undefined
      };

      let result;
      if (isNew) {
        result = await supabase.from('assets').insert(assetData).select('id').single();
      } else {
        result = await supabase.from('assets').update(assetData).eq('id', id).select('id').single();
      }

      if (result.error) throw result.error;

      await supabase.from('asset_history').insert({
        asset_id: result.data.id,
        action: isNew ? 'Utworzenie' : 'Edycja',
        description: isNew ? 'Sprzęt dodany do ewidencji' : 'Zaktualizowano dane sprzętu',
        performed_by: user?.id
      });

      navigate(`/assets/${result.data.id}`);
    } catch (error) {
      console.error('Error saving asset:', error);
      setSubmitError('Wystąpił błąd podczas zapisywania. Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={isNew ? '/assets' : `/assets/${id}`} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Nowy sprzęt' : 'Edytuj sprzęt'}
        </h1>
      </div>

      {submitError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Podstawowe informacje</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Nazwa"
                  required
                  value={form.values.name}
                  onChange={(e) => form.handleChange('name', e.target.value)}
                  onBlur={() => form.handleBlur('name')}
                  error={form.touched.name ? form.errors.name : undefined}
                  placeholder="np. Dell Latitude 5520"
                  helpText="Wymagana nazwa zasobu, max 200 znaków"
                />
              </div>
              <Select
                label="Kategoria"
                options={categories.map(c => ({ value: c.id, label: c.name }))}
                value={form.values.category_id}
                onChange={(e) => form.handleChange('category_id', e.target.value)}
                onBlur={() => form.handleBlur('category_id')}
                placeholder="Wybierz kategorię"
              />
              <Input
                label="Producent"
                value={form.values.manufacturer}
                onChange={(e) => form.handleChange('manufacturer', e.target.value)}
                onBlur={() => form.handleBlur('manufacturer')}
                placeholder="np. Dell"
              />
              <Input
                label="Model"
                value={form.values.model}
                onChange={(e) => form.handleChange('model', e.target.value)}
                onBlur={() => form.handleBlur('model')}
                placeholder="np. Latitude 5520"
              />
              <Input
                label="Numer seryjny"
                value={form.values.serial_number}
                onChange={(e) => form.handleChange('serial_number', e.target.value)}
                onBlur={() => form.handleBlur('serial_number')}
                error={form.touched.serial_number ? form.errors.serial_number : undefined}
                placeholder="np. SN123456789"
              />
              <Input
                label="Numer inwentarzowy"
                value={form.values.inventory_number}
                onChange={(e) => form.handleChange('inventory_number', e.target.value)}
                onBlur={() => form.handleBlur('inventory_number')}
                error={form.touched.inventory_number ? form.errors.inventory_number : undefined}
                placeholder="np. INV/001/2024"
              />
              <Input
                label="Tag inwentarzowy"
                value={form.values.asset_tag}
                onChange={(e) => form.handleChange('asset_tag', e.target.value)}
                onBlur={() => form.handleBlur('asset_tag')}
                error={form.touched.asset_tag ? form.errors.asset_tag : undefined}
                placeholder="np. ASSET-001"
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informacje o zakupie</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                type="date"
                label="Data zakupu"
                value={form.values.purchase_date}
                onChange={(e) => form.handleChange('purchase_date', e.target.value)}
                onBlur={() => form.handleBlur('purchase_date')}
                error={form.touched.purchase_date ? form.errors.purchase_date : undefined}
              />
              <Input
                type="number"
                label="Wartość (PLN)"
                value={form.values.purchase_price}
                onChange={(e) => form.handleChange('purchase_price', e.target.value)}
                onBlur={() => form.handleBlur('purchase_price')}
                error={form.touched.purchase_price ? form.errors.purchase_price : undefined}
                placeholder="0.00"
                helpText="Format: 1500.00"
              />
              <Input
                type="number"
                label="Gwarancja (miesiące)"
                value={form.values.warranty_months}
                onChange={(e) => form.handleChange('warranty_months', e.target.value)}
                onBlur={() => form.handleBlur('warranty_months')}
                error={form.touched.warranty_months ? form.errors.warranty_months : undefined}
                placeholder="24"
              />
              <Select
                label="Dostawca"
                options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                value={form.values.supplier_id}
                onChange={(e) => form.handleChange('supplier_id', e.target.value)}
                onBlur={() => form.handleBlur('supplier_id')}
                placeholder="Wybierz dostawcę"
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Przypisanie</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Status"
                options={statuses.map(s => ({ value: s.id, label: s.name }))}
                value={form.values.status_id}
                onChange={(e) => form.handleChange('status_id', e.target.value)}
                onBlur={() => form.handleBlur('status_id')}
                placeholder="Wybierz status"
              />
              <Select
                label="Lokalizacja"
                options={locations.map(l => ({ value: l.id, label: l.name }))}
                value={form.values.location_id}
                onChange={(e) => form.handleChange('location_id', e.target.value)}
                onBlur={() => form.handleBlur('location_id')}
                placeholder="Wybierz lokalizację"
              />
              <Select
                label="Przypisany do"
                options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                value={form.values.assigned_to}
                onChange={(e) => form.handleChange('assigned_to', e.target.value)}
                onBlur={() => form.handleBlur('assigned_to')}
                placeholder="Wybierz pracownika"
              />
            </div>
          </Card>

          {!isNew && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Zdjęcia</h2>
              <div className="space-y-4">
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" aria-label="Upload Image" />
                <Button type="button" variant="outline" icon={<Image className="w-4 h-4" />} onClick={() => imageInputRef.current?.click()} loading={uploadingImage}>
                  Dodaj zdjęcie
                </Button>
                {images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map(img => (
                      <div key={img.id} className="relative group">
                        <img src={`https://vfsxnnmyhddqwyjzxqyp.supabase.co/storage/v1/object/public/documents/${img.file_path}`} alt={img.name} className="w-full h-24 object-cover rounded-lg border" />
                        <button type="button" onClick={() => handleDeleteDocument(img.id, img.file_path, 'image')} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" title="Delete document">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {!isNew && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Dokumenty</h2>
              <div className="space-y-4">
                <input 
                ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleDocUpload} 
                className="hidden" aria-label="file"/>
                <Button type="button" variant="outline" icon={<Upload className="w-4 h-4" />} onClick={() => docInputRef.current?.click()} loading={uploadingDoc}>
                  Dodaj dokument (faktura, instrukcja, gwarancja)
                </Button>
                {documents.length > 0 && (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                            <p className="text-xs text-gray-500">{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`https://vfsxnnmyhddqwyjzxqyp.supabase.co/storage/v1/object/public/documents/${doc.file_path}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Pobierz</a>
                          <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4 text-red-500" />} onClick={() => handleDeleteDocument(doc.id, doc.file_path, 'document')} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dodatkowe informacje</h2>
            <div className="space-y-4">
              <Textarea
                label="Opis"
                value={form.values.description}
                onChange={(e) => form.handleChange('description', e.target.value)}
                onBlur={() => form.handleBlur('description')}
                error={form.touched.description ? form.errors.description : undefined}
                rows={3}
                placeholder="Opis sprzętu..."
              />
              <Textarea
                label="Uwagi"
                value={form.values.notes}
                onChange={(e) => form.handleChange('notes', e.target.value)}
                onBlur={() => form.handleBlur('notes')}
                error={form.touched.notes ? form.errors.notes : undefined}
                rows={2}
                placeholder="Dodatkowe uwagi..."
              />
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Link to={isNew ? '/assets' : `/assets/${id}`}>
              <Button variant="outline" type="button">Anuluj</Button>
            </Link>
            <Button type="submit" icon={<Save className="w-4 h-4" />} loading={saving}>
              {isNew ? 'Dodaj sprzęt' : 'Zapisz zmiany'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
