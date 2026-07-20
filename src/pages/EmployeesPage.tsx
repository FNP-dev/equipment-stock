import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Employee, Location } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { PageLoader } from '../components/Loading';
import { useFormValidation, validators } from '../hooks/useFormValidation';
import { Plus, Edit, Trash2, User, Mail, Building, MapPin, Package } from 'lucide-react';

interface EmployeeWithAssets extends Employee {
  asset_count?: number;
}

export default function EmployeesPage() {
  const { isManagerOrAdmin, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeWithAssets[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useFormValidation(
    { first_name: '', last_name: '', email: '', phone: '', department: '', position: '', location_id: '', notes: '' },
    {
      first_name: [validators.required('Imię jest wymagane'), validators.maxLength(50, 'Maksimum 50 znaków')],
      last_name: [validators.required('Nazwisko jest wymagane'), validators.maxLength(50, 'Maksimum 50 znaków')],
      email: [validators.email('Podaj prawidłowy adres email'), validators.maxLength(100, 'Maksimum 100 znaków')],
      phone: [validators.phone('Podaj prawidłowy numer telefonu')],
      department: [validators.maxLength(100, 'Maksimum 100 znaków')],
      position: [validators.maxLength(100, 'Maksimum 100 znaków')],
      notes: [validators.maxLength(500, 'Maksimum 500 znaków')],
    }
  );

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const [empRes, locRes, assetsRes] = await Promise.all([
        supabase.from('employees').select('*').eq('status', 'active').order('first_name'),
        supabase.from('locations').select('*').eq('is_active', true).order('name'),
        supabase.from('assets').select('assigned_to').eq('is_active', true)
      ]);

      const assetCounts: Record<string, number> = {};
      (assetsRes.data || []).forEach(asset => {
        if (asset.assigned_to) {
          assetCounts[asset.assigned_to] = (assetCounts[asset.assigned_to] || 0) + 1;
        }
      });

      const employeesWithAssets = (empRes.data || []).map(emp => ({
        ...emp,
        asset_count: assetCounts[emp.id] || 0
      }));

      setEmployees(employeesWithAssets);
      setLocations(locRes.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(employee?: Employee) {
    if (employee) {
      setEditingEmployee(employee);
      form.setValues({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email || '',
        phone: employee.phone || '',
        department: employee.department || '',
        position: employee.position || '',
        location_id: employee.location_id || '',
        notes: employee.notes || ''
      });
    } else {
      setEditingEmployee(null);
      form.reset();
    }
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      const data = {
        first_name: form.values.first_name.trim(),
        last_name: form.values.last_name.trim(),
        email: form.values.email.trim() || null,
        phone: form.values.phone.trim() || null,
        department: form.values.department.trim() || null,
        position: form.values.position.trim() || null,
        location_id: form.values.location_id || null,
        notes: form.values.notes.trim() || null
      };

      if (editingEmployee) {
        await supabase.from('employees').update(data).eq('id', editingEmployee.id);
      } else {
        await supabase.from('employees').insert(data);
      }
      setShowModal(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć tego pracownika?')) return;
    try {
      await supabase.from('employees').update({ is_active: false }).eq('id', id);
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pracownicy</h1>
          <p className="text-gray-500 text-sm mt-1">Lista pracowników firmy</p>
        </div>
        {isManagerOrAdmin && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => openModal()}>
            Dodaj pracownika
          </Button>
        )}
      </div>

      {employees.length === 0 ? (
        <Card>
          <EmptyState
            icon={<User className="w-8 h-8 text-gray-400" />}
            title="Brak pracowników"
            description="Dodaj pierwszego pracownika"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((employee) => (
            <Card key={employee.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-lg font-medium text-blue-700">
                      {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>
                    {employee.position && <p className="text-sm text-gray-500">{employee.position}</p>}
                  </div>
                </div>
                {isManagerOrAdmin && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" icon={<Edit className="w-4 h-4" />} onClick={() => openModal(employee)} />
                    {isAdmin && (
                      <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => handleDelete(employee.id)} />
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {employee.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{employee.email}</span>
                  </div>
                )}
                {employee.department && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building className="w-4 h-4 text-gray-400" />
                    <span>{employee.department}</span>
                  </div>
                )}
                {employee.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{employee.location.name}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {employee.asset_count || 0} {employee.asset_count === 1 ? 'sprzęt' : employee.asset_count && employee.asset_count < 5 ? 'sprzęty' : 'sprzętów'}
                </span>
                <Link
                  to={`/assets?employee=${employee.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Zobacz sprzęt
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingEmployee ? 'Edytuj pracownika' : 'Nowy pracownik'} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Imię"
              required
              value={form.values.first_name}
              onChange={(e) => form.handleChange('first_name', e.target.value)}
              onBlur={() => form.handleBlur('first_name')}
              error={form.touched.first_name ? form.errors.first_name : undefined}
              placeholder="Jan"
            />
            <Input
              label="Nazwisko"
              required
              value={form.values.last_name}
              onChange={(e) => form.handleChange('last_name', e.target.value)}
              onBlur={() => form.handleBlur('last_name')}
              error={form.touched.last_name ? form.errors.last_name : undefined}
              placeholder="Kowalski"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={form.values.email}
              onChange={(e) => form.handleChange('email', e.target.value)}
              onBlur={() => form.handleBlur('email')}
              error={form.touched.email ? form.errors.email : undefined}
              placeholder="jan@firma.pl"
            />
            <Input
              label="Telefon"
              value={form.values.phone}
              onChange={(e) => form.handleChange('phone', e.target.value)}
              onBlur={() => form.handleBlur('phone')}
              error={form.touched.phone ? form.errors.phone : undefined}
              placeholder="+48 123 456 789"
              helpText="Format: +48 123 456 789"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Dział"
              value={form.values.department}
              onChange={(e) => form.handleChange('department', e.target.value)}
              onBlur={() => form.handleBlur('department')}
              error={form.touched.department ? form.errors.department : undefined}
              placeholder="np. IT"
            />
            <Input
              label="Stanowisko"
              value={form.values.position}
              onChange={(e) => form.handleChange('position', e.target.value)}
              onBlur={() => form.handleBlur('position')}
              error={form.touched.position ? form.errors.position : undefined}
              placeholder="np. Administrator"
            />
          </div>
          <Select
            label="Lokalizacja"
            options={locations.map(l => ({ value: l.id, label: l.name }))}
            value={form.values.location_id}
            onChange={(e) => form.handleChange('location_id', e.target.value)}
            onBlur={() => form.handleBlur('location_id')}
            placeholder="Wybierz lokalizację"
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
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>Anuluj</Button>
            <Button onClick={handleSave} loading={saving}>Zapisz</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
