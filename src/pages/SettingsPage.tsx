import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Status } from '../lib/types';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { PageLoader } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import { useFormValidation, validators } from '../hooks/useFormValidation';
import {
  Settings as SettingsIcon, Plus, Edit, Trash2, Tag, Shield,
  User, Lock, Bell, Check, AlertCircle, Mail
} from 'lucide-react';

type Tab = 'profile' | 'security' | 'preferences' | 'system';

export default function SettingsPage() {
  const { isAdmin, user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [statusForm, setStatusForm] = useState({ name: '', description: '', color: '#3B82F6' });
  const [savingStatus, setSavingStatus] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const profileForm = useFormValidation(
    { first_name: '', last_name: '', phone: '' },
    {
      first_name: [validators.required('Imię jest wymagane'), validators.maxLength(50, 'Maksimum 50 znaków')],
      last_name: [validators.required('Nazwisko jest wymagane'), validators.maxLength(50, 'Maksimum 50 znaków')],
      phone: [validators.phone('Podaj prawidłowy numer telefonu')],
    }
  );

  const passwordForm = useFormValidation(
    { currentPassword: '', newPassword: '', confirmPassword: '' },
    {
      currentPassword: [validators.required('Aktualne hasło jest wymagane')],
      newPassword: [validators.required('Nowe hasło jest wymagane'), validators.minLength(8, 'Hasło musi mieć minimum 8 znaków')],
      confirmPassword: [validators.required('Potwierdź nowe hasło'), validators.match('newPassword', 'Hasła nie są zgodne')],
    }
  );

  useEffect(() => {
    fetchStatuses();
    if (profile) {
      profileForm.setValues({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || ''
      });
    }
  }, [profile]);

  async function fetchStatuses() {
    try {
      const { data } = await supabase.from('statuses').select('*').order('sort_order');
      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!profileForm.validateAll()) return;
    setProfileError(null);
    setProfileSaved(false);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: profileForm.values.first_name.trim(),
          last_name: profileForm.values.last_name.trim(),
          phone: profileForm.values.phone.trim() || null,
        })
        .eq('user_id', user?.id);

      if (error) throw error;
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setProfileError('Nie udało się zapisać profilu. Spróbuj ponownie.');
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.validateAll()) return;
    setPasswordError(null);
    setPasswordSuccess(null);
    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.values.newPassword
      });

      if (error) throw error;
      setPasswordSuccess('Hasło zostało zmienione.');
      passwordForm.reset();
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (error: any) {
      setPasswordError(error.message || 'Nie udało się zmienić hasła.');
    } finally {
      setChangingPassword(false);
    }
  }

  function openStatusModal(status?: Status) {
    if (status) {
      setEditingStatus(status);
      setStatusForm({ name: status.name, description: status.description || '', color: status.color || '#3B82F6' });
    } else {
      setEditingStatus(null);
      setStatusForm({ name: '', description: '', color: '#3B82F6' });
    }
    setShowStatusModal(true);
  }

  async function handleSaveStatus() {
    if (!statusForm.name.trim()) return;
    setSavingStatus(true);
    try {
      if (editingStatus) {
        await supabase
          .from('statuses')
          .update({ name: statusForm.name.trim(), description: statusForm.description.trim() || null, color: statusForm.color })
          .eq('id', editingStatus.id);
      } else {
        await supabase
          .from('statuses')
          .insert({ name: statusForm.name.trim(), description: statusForm.description.trim() || null, color: statusForm.color, sort_order: statuses.length + 1 });
      }
      setShowStatusModal(false);
      fetchStatuses();
    } catch (error) {
      console.error('Error saving status:', error);
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDeleteStatus(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć ten status?')) return;
    try {
      await supabase.from('statuses').update({ is_active: false }).eq('id', id);
      fetchStatuses();
    } catch (error) {
      console.error('Error deleting status:', error);
    }
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Brak dostępu</h1>
        <p className="text-gray-500 mt-2">Nie masz uprawnień do tej strony.</p>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'security', label: 'Bezpieczeństwo', icon: Lock },
    { id: 'preferences', label: 'Preferencje', icon: Bell },
    { id: 'system', label: 'System', icon: SettingsIcon },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ustawienia</h1>
        <p className="text-gray-500 text-sm mt-1">Zarządzaj swoim kontem i systemem</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Informacje o koncie</h2>
            <p className="text-sm text-gray-500 mb-4">Zaktualizuj swoje dane osobowe</p>

            {profileSaved && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                <p className="text-sm text-green-700">Profil zapisany pomyślnie</p>
              </div>
            )}
            {profileError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-sm text-red-700">{profileError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Imię"
                  required
                  value={profileForm.values.first_name}
                  onChange={(e) => profileForm.handleChange('first_name', e.target.value)}
                  onBlur={() => profileForm.handleBlur('first_name')}
                  error={profileForm.touched.first_name ? profileForm.errors.first_name : undefined}
                  placeholder="Jan"
                />
                <Input
                  label="Nazwisko"
                  required
                  value={profileForm.values.last_name}
                  onChange={(e) => profileForm.handleChange('last_name', e.target.value)}
                  onBlur={() => profileForm.handleBlur('last_name')}
                  error={profileForm.touched.last_name ? profileForm.errors.last_name : undefined}
                  placeholder="Kowalski"
                />
              </div>

              <Input
                label="Telefon"
                value={profileForm.values.phone}
                onChange={(e) => profileForm.handleChange('phone', e.target.value)}
                onBlur={() => profileForm.handleBlur('phone')}
                error={profileForm.touched.phone ? profileForm.errors.phone : undefined}
                placeholder="+48 123 456 789"
                helpText="Format: +48 123 456 789"
              />

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveProfile} icon={<Check className="w-4 h-4" />}>
                  Zapisz zmiany
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Zmiana hasła</h2>
            <p className="text-sm text-gray-500 mb-4">Ustaw nowe hasło dla swojego konta</p>

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                <p className="text-sm text-green-700">{passwordSuccess}</p>
              </div>
            )}
            {passwordError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-sm text-red-700">{passwordError}</p>
              </div>
            )}

            <div className="space-y-4">
              <Input
                type="password"
                label="Aktualne hasło"
                required
                value={passwordForm.values.currentPassword}
                onChange={(e) => passwordForm.handleChange('currentPassword', e.target.value)}
                onBlur={() => passwordForm.handleBlur('currentPassword')}
                error={passwordForm.touched.currentPassword ? passwordForm.errors.currentPassword : undefined}
                placeholder="••••••••"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  type="password"
                  label="Nowe hasło"
                  required
                  value={passwordForm.values.newPassword}
                  onChange={(e) => passwordForm.handleChange('newPassword', e.target.value)}
                  onBlur={() => passwordForm.handleBlur('newPassword')}
                  error={passwordForm.touched.newPassword ? passwordForm.errors.newPassword : undefined}
                  placeholder="••••••••"
                  helpText="Minimum 8 znaków"
                />
                <Input
                  type="password"
                  label="Potwierdź hasło"
                  required
                  value={passwordForm.values.confirmPassword}
                  onChange={(e) => passwordForm.handleChange('confirmPassword', e.target.value)}
                  onBlur={() => passwordForm.handleBlur('confirmPassword')}
                  error={passwordForm.touched.confirmPassword ? passwordForm.errors.confirmPassword : undefined}
                  placeholder="••••••••"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleChangePassword} loading={changingPassword}>
                  Zmień hasło
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Sesje</h2>
            <p className="text-sm text-gray-500 mb-4">Aktywne sesje na Twoim koncie</p>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Aktualna sesja</p>
                  <p className="text-xs text-gray-500">Zalogowano jako {user?.email}</p>
                </div>
              </div>
              <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded-full">Aktywna</span>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Powiadomienia</h2>
            <p className="text-sm text-gray-500 mb-4">Zarządzaj powiadomieniami systemu</p>
            <div className="space-y-3">
              {[
                { label: 'Powiadomienia email', desc: 'Otrzymuj powiadomienia o zmianach sprzętu' },
                { label: 'Alerty o gwarancji', desc: 'Powiadomienia o kończącej się gwarancji' },
                { label: 'Raporty miesięczne', desc: 'Miesięczne podsumowanie stanu sprzętu' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={i === 0}
                      className="sr-only peer"
                      aria-label={item.label}
                      title={item.label}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Wygląd</h2>
            <p className="text-sm text-gray-500 mb-4">Dostosuj wygląd interfejsu</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">Tryb ciemny</p>
                  <p className="text-xs text-gray-500">Przełącz na ciemny motyw</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    aria-label="Tryb ciemny"
                    title="Tryb ciemny"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Statusy sprzętu</h2>
                <p className="text-sm text-gray-500 mt-0.5">Zarządzaj dostępnymi statusami</p>
              </div>
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => openStatusModal()}>
                Dodaj status
              </Button>
            </div>
            <div className="space-y-2">
              {statuses.filter(s => s.is_active).map((status) => (
                <div key={status.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: status.color ? `${status.color}20` : '#f3f4f6' }}
                    >
                      <Tag className="w-4 h-4" style={{ color: status.color || '#6b7280' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{status.name}</p>
                      {status.description && <p className="text-xs text-gray-500">{status.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" icon={<Edit className="w-4 h-4" />} onClick={() => openStatusModal(status)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4 text-red-500" />} onClick={() => handleDeleteStatus(status.id)} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Informacje o systemie</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Wersja</span>
                <span className="text-gray-900 font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Środowisko</span>
                <span className="text-gray-900 font-medium">Production</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Baza danych</span>
                <span className="text-gray-900 font-medium">Supabase PostgreSQL</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Autoryzacja</span>
                <span className="text-gray-900 font-medium">Supabase Auth</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title={editingStatus ? 'Edytuj status' : 'Nowy status'}>
        <div className="p-6 space-y-4">
          <Input
            label="Nazwa"
            required
            value={statusForm.name}
            onChange={(e) => setStatusForm({ ...statusForm, name: e.target.value })}
            placeholder="np. W naprawie"
          />
          <Input
            label="Opis"
            value={statusForm.description}
            onChange={(e) => setStatusForm({ ...statusForm, description: e.target.value })}
            placeholder="Opcjonalny opis statusu"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Kolor</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={statusForm.color}
                onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                className="w-12 h-12 rounded cursor-pointer"
                aria-label="Color"
                title="Color"
              />
              <span className="text-sm text-gray-500">{statusForm.color}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>Anuluj</Button>
            <Button onClick={handleSaveStatus} loading={savingStatus}>Zapisz</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
