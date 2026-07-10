import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Asset, AssetHistory, Status, Employee, Location } from '../lib/types';
import Card, { CardHeader } from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Select from '../components/Select';
import { PageLoader } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, Edit, ArrowLeft, Trash2, Calendar, DollarSign,
  MapPin, User, Tag, History, AlertTriangle, Award, FileText
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManagerOrAdmin, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AssetHistory[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) fetchAsset();
  }, [id]);

  async function fetchAsset() {
    try {
      const [assetRes, historyRes] = await Promise.all([
        supabase
          .from('assets')
          .select('*, category:categories(*), location:locations(*), status:statuses(*), employee:employees(*)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('asset_history')
          .select('*')
          .eq('asset_id', id)
          .order('performed_at', { ascending: false })
      ]);

      setAsset(assetRes.data);
      setHistory(historyRes.data || []);

      if (!statuses.length) {
        const [statRes, empRes, locRes] = await Promise.all([
          supabase.from('statuses').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('employees').select('*').eq('is_active', true).order('first_name'),
          supabase.from('locations').select('*').eq('is_active', true).order('name')
        ]);
        setStatuses(statRes.data || []);
        setEmployees(empRes.data || []);
        setLocations(locRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching asset:', error);
    } finally {
      setLoading(false);
    }
  }

  async function logHistory(action: string, fieldName: string | null, oldValue: string | null, newValue: string | null, description: string) {
    await supabase.from('asset_history').insert({
      asset_id: id,
      action,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      description,
      performed_by: user?.id
    });
  }

  async function handleAssign() {
    if (!asset || !selectedEmployee) return;
    setActionLoading(true);
    try {
      const employee = employees.find(e => e.id === selectedEmployee);
      const oldEmployee = asset.employee;

      await supabase
        .from('assets')
        .update({ assigned_to: selectedEmployee, status_id: statuses.find(s => s.name === 'Przypisany')?.id })
        .eq('id', asset.id);

      await logHistory(
        'Przypisanie',
        'assigned_to',
        oldEmployee ? `${oldEmployee.first_name} ${oldEmployee.last_name}` : null,
        employee ? `${employee.first_name} ${employee.last_name}` : null,
        `Sprzęt przypisany do ${employee?.first_name} ${employee?.last_name}`
      );

      setShowAssignModal(false);
      fetchAsset();
    } catch (error) {
      console.error('Error assigning asset:', error);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnassign() {
    if (!asset) return;
    setActionLoading(true);
    try {
      const oldEmployee = asset.employee;

      await supabase
        .from('assets')
        .update({ assigned_to: null, status_id: statuses.find(s => s.name === 'Dostępny')?.id })
        .eq('id', asset.id);

      await logHistory(
        'Zwrot',
        'assigned_to',
        oldEmployee ? `${oldEmployee.first_name} ${oldEmployee.last_name}` : null,
        null,
        'Sprzęt zwrócony'
      );

      fetchAsset();
    } catch (error) {
      console.error('Error unassigning asset:', error);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusChange() {
    if (!asset || !selectedStatus) return;
    setActionLoading(true);
    try {
      const newStatus = statuses.find(s => s.id === selectedStatus);

      await supabase
        .from('assets')
        .update({ status_id: selectedStatus })
        .eq('id', asset.id);

      await logHistory(
        'Zmiana statusu',
        'status_id',
        asset.status?.name || null,
        newStatus?.name || null,
        `Status zmieniony z ${asset.status?.name || 'brak'} na ${newStatus?.name}`
      );

      setShowStatusModal(false);
      fetchAsset();
    } catch (error) {
      console.error('Error changing status:', error);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLocationChange() {
    if (!asset || !selectedLocation) return;
    setActionLoading(true);
    try {
      const newLocation = locations.find(l => l.id === selectedLocation);

      await supabase
        .from('assets')
        .update({ location_id: selectedLocation })
        .eq('id', asset.id);

      await logHistory(
        'Zmiana lokalizacji',
        'location_id',
        asset.location?.name || null,
        newLocation?.name || null,
        `Lokalizacja zmieniona z ${asset.location?.name || 'brak'} na ${newLocation?.name}`
      );

      setShowLocationModal(false);
      fetchAsset();
    } catch (error) {
      console.error('Error changing location:', error);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!asset) return;
    setActionLoading(true);
    try {
      await supabase
        .from('assets')
        .update({ is_active: false })
        .eq('id', asset.id);

      await logHistory('Usunięcie', null, null, null, 'Sprzęt został usunięty z ewidencji');
      navigate('/assets');
    } catch (error) {
      console.error('Error deleting asset:', error);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <PageLoader />;
  if (!asset) return (
    <div className="text-center py-12">
      <p className="text-gray-500">Nie znaleziono sprzętu</p>
      <Link to="/assets" className="text-blue-600 hover:underline mt-2 inline-block">Powrót do listy</Link>
    </div>
  );

  const warrantyDaysLeft = asset.warranty_end_date
    ? differenceInDays(new Date(asset.warranty_end_date), new Date())
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/assets" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
          <p className="text-gray-500 text-sm">
            {asset.manufacturer} {asset.model} • {asset.asset_tag || 'Brak tagu'}
          </p>
        </div>
        {isManagerOrAdmin && (
          <div className="flex items-center gap-2">
            <Link to={`/assets/${asset.id}/edit`}>
              <Button variant="outline" icon={<Edit className="w-4 h-4" />}>Edytuj</Button>
            </Link>
            {isAdmin && (
              <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => setShowDeleteModal(true)}>
                Usuń
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Status & Warranty Banner */}
      <div className="flex flex-wrap items-center gap-4">
        {asset.status && (
          <span
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
            style={{
              backgroundColor: asset.status.color ? `${asset.status.color}20` : '#f3f4f6',
              color: asset.status.color || '#6b7280'
            }}
          >
            {asset.status.name}
          </span>
        )}
        {warrantyDaysLeft !== null && warrantyDaysLeft > 0 && warrantyDaysLeft <= 30 && (
          <span className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium bg-amber-50 text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            Gwarancja kończy się za {warrantyDaysLeft} dni
          </span>
        )}
        {warrantyDaysLeft !== null && warrantyDaysLeft < 0 && (
          <span className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium bg-red-50 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            Gwarancja wygasła
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Informacje podstawowe" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem icon={<Package className="w-4 h-4" />} label="Kategoria" value={asset.category?.name} />
              <InfoItem icon={<Tag className="w-4 h-4" />} label="Numer seryjny" value={asset.serial_number} />
              <InfoItem icon={<Tag className="w-4 h-4" />} label="Tag inwentarzowy" value={asset.asset_tag} />
              <InfoItem icon={<Package className="w-4 h-4" />} label="Producent" value={asset.manufacturer} />
              <InfoItem icon={<Package className="w-4 h-4" />} label="Model" value={asset.model} />
              <InfoItem icon={<DollarSign className="w-4 h-4" />} label="Wartość" value={asset.purchase_price ? `${asset.purchase_price} ${asset.currency}` : null} />
              <InfoItem icon={<Calendar className="w-4 h-4" />} label="Data zakupu" value={asset.purchase_date ? format(new Date(asset.purchase_date), 'dd.MM.yyyy') : null} />
              <InfoItem icon={<Award className="w-4 h-4" />} label="Gwarancja do" value={asset.warranty_end_date ? format(new Date(asset.warranty_end_date), 'dd.MM.yyyy') : null} />
            </div>
            {asset.description && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">Opis</p>
                <p className="text-sm text-gray-600">{asset.description}</p>
              </div>
            )}
          </Card>

          {/* History */}
          <Card>
            <CardHeader title="Historia zmian" />
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Brak historii</p>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.action}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(item.performed_at), 'dd MMM yyyy, HH:mm', { locale: pl })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Przypisanie" />
            {asset.employee ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {asset.employee.first_name} {asset.employee.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{asset.employee.department || ''}</p>
                  </div>
                </div>
                {isManagerOrAdmin && (
                  <Button variant="outline" className="w-full" onClick={handleUnassign} loading={actionLoading}>
                    Zwróć sprzęt
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">Nieprzypisany</p>
                {isManagerOrAdmin && (
                  <Button onClick={() => setShowAssignModal(true)}>Przypisz</Button>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Lokalizacja" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-900">{asset.location?.name || 'Brak lokalizacji'}</span>
              </div>
              {isManagerOrAdmin && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setSelectedLocation(asset.location_id || '');
                  setShowLocationModal(true);
                }}>
                  Zmień
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Status" />
            <div className="flex items-center justify-between">
              {asset.status && (
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: asset.status.color ? `${asset.status.color}20` : '#f3f4f6',
                    color: asset.status.color || '#6b7280'
                  }}
                >
                  {asset.status.name}
                </span>
              )}
              {isManagerOrAdmin && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setSelectedStatus(asset.status_id || '');
                  setShowStatusModal(true);
                }}>
                  Zmień
                </Button>
              )}
            </div>
          </Card>

          {asset.notes && (
            <Card>
              <CardHeader title="Uwagi" />
              <p className="text-sm text-gray-600">{asset.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title="Przypisz sprzęt">
        <div className="p-6 space-y-4">
          <Select
            label="Pracownik"
            options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name} (${e.department || 'brak działu'})` }))}
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            placeholder="Wybierz pracownika"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>Anuluj</Button>
            <Button onClick={handleAssign} loading={actionLoading}>Przypisz</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="Zmień status">
        <div className="p-6 space-y-4">
          <Select
            label="Nowy status"
            options={statuses.map(s => ({ value: s.id, label: s.name }))}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>Anuluj</Button>
            <Button onClick={handleStatusChange} loading={actionLoading}>Zmień</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showLocationModal} onClose={() => setShowLocationModal(false)} title="Zmień lokalizację">
        <div className="p-6 space-y-4">
          <Select
            label="Nowa lokalizacja"
            options={locations.map(l => ({ value: l.id, label: l.name }))}
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowLocationModal(false)}>Anuluj</Button>
            <Button onClick={handleLocationChange} loading={actionLoading}>Zmień</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Usuń sprzęt">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Czy na pewno chcesz usunąć sprzęt <strong>{asset.name}</strong>? Ta operacja jest nieodwracalna.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Anuluj</Button>
            <Button variant="danger" onClick={handleDelete} loading={actionLoading}>Usuń</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-900">{value || '-'}</p>
      </div>
    </div>
  );
}
