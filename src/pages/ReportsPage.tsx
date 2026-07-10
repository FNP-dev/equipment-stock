import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Asset, Category, Location, Employee, Status, Repair } from '../lib/types';
import Card, { CardHeader } from '../components/Card';
import Button from '../components/Button';
import { PageLoader } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import {
  Download, Package, MapPin, Users, AlertTriangle,
  DollarSign, Wrench
} from 'lucide-react';
import { differenceInDays, addDays, format, parseISO } from 'date-fns';

interface ChartBarProps {
  value: number;
  max: number;
  color?: string;
  label: string;
  sublabel?: string;
}

function ChartBar({ value, max, color = '#3b82f6', label, sublabel }: ChartBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-32 text-sm text-gray-600 truncate">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        >
          {percentage > 15 && (
            <span className="text-xs font-medium text-white">{value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
          )}
        </div>
      </div>
      {percentage <= 15 && (
        <span className="text-sm font-medium text-gray-700 w-24 text-right">{value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
      )}
      {sublabel && <span className="text-xs text-gray-400 w-16 text-right">{sublabel}</span>}
    </div>
  );
}

interface PieSegmentProps {
  value: number;
  total: number;
  color: string;
  label: string;
}

function PieChartVisual({ data }: { data: PieSegmentProps[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = -90;

  const segments = data.map((d) => {
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...d, startAngle, angle, endAngle: currentAngle };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-40 h-40">
        {segments.map((s, i) => {
          const startRad = (s.startAngle * Math.PI) / 180;
          const endRad = (s.endAngle * Math.PI) / 180;
          const x1 = 50 + 40 * Math.cos(startRad);
          const y1 = 50 + 40 * Math.sin(startRad);
          const x2 = 50 + 40 * Math.cos(endRad);
          const y2 = 50 + 40 * Math.sin(endRad);
          const largeArc = s.angle > 180 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={s.color}
              stroke="white"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div className="flex-1 space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="flex-1 text-gray-600">{d.label}</span>
            <span className="font-medium">{d.value}</span>
            <span className="text-gray-400 text-xs">({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { isManagerOrAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [assetsRes, catRes, locRes, empRes, statRes, repairsRes] = await Promise.all([
        supabase.from('assets').select('*, category:categories(*), location:locations(*), status:statuses(*), employee:employees(*)').eq('is_active', true),
        supabase.from('categories').select('*').eq('is_active', true),
        supabase.from('locations').select('*').eq('is_active', true),
        supabase.from('employees').select('*').eq('is_active', true),
        supabase.from('statuses').select('*').eq('is_active', true),
        supabase.from('repairs').select('*')
      ]);
      setAssets(assetsRes.data || []);
      setCategories(catRes.data || []);
      setLocations(locRes.data || []);
      setEmployees(empRes.data || []);
      setStatuses(statRes.data || []);
      setRepairs(repairsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate total value
  const totalValue = assets.reduce((sum, a) => sum + (a.purchase_price || 0), 0);
  const assignedValue = assets.filter(a => a.assigned_to).reduce((sum, a) => sum + (a.purchase_price || 0), 0);
  const unassignedValue = totalValue - assignedValue;

  // Top value assets
  const topValueAssets = [...assets].sort((a, b) => (b.purchase_price || 0) - (a.purchase_price || 0)).slice(0, 10);

  // Purchases by year
  const purchasesByYear = assets.reduce((acc, asset) => {
    if (asset.purchase_date) {
      const year = parseISO(asset.purchase_date).getFullYear();
      acc[year] = (acc[year] || 0) + 1;
    }
    return acc;
  }, {} as Record<number, number>);

  const sortedYears = Object.keys(purchasesByYear).map(Number).sort((a, b) => a - b);

  // Purchases by month (current year)
  const currentYear = new Date().getFullYear();
  const purchasesByMonth = assets
    .filter(a => a.purchase_date && parseISO(a.purchase_date).getFullYear() === currentYear)
    .reduce((acc, asset) => {
      const month = parseISO(asset.purchase_date).getMonth();
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

  const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
  const maxMonthPurchases = Math.max(...Object.values(purchasesByMonth), 1);

  // Repairs analysis
  const totalRepairCosts = repairs.reduce((sum, r) => sum + (r.cost || 0), 0);
  const repairsByAsset = repairs.reduce((acc, repair) => {
    acc[repair.asset_id] = (acc[repair.asset_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostRepairedAssets = Object.entries(repairsByAsset)
    .map(([assetId, count]) => ({
      asset: assets.find(a => a.id === assetId),
      count
    }))
    .filter(r => r.asset)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Category distribution
  const categoryData = categories.map(cat => ({
    label: cat.name,
    value: assets.filter(a => a.category_id === cat.id).length,
    color: cat.color || '#3b82f6'
  })).filter(d => d.value > 0);

  // Status distribution
  const statusData = statuses.map(stat => ({
    label: stat.name,
    value: assets.filter(a => a.status_id === stat.id).length,
    color: stat.color || '#6b7280'
  })).filter(d => d.value > 0);

  // Warranty ending soon
  const warrantyEndingSoon = assets
    .filter(a => {
      if (!a.warranty_end_date) return false;
      const endDate = parseISO(a.warranty_end_date);
      return endDate <= addDays(new Date(), 90);
    })
    .sort((a, b) => {
      const aDate = a.warranty_end_date ? parseISO(a.warranty_end_date).getTime() : Infinity;
      const bDate = b.warranty_end_date ? parseISO(b.warranty_end_date).getTime() : Infinity;
      return aDate - bDate;
    });

  function exportToCSV(data: Record<string, unknown>[], filename: string) {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(';'),
      ...data.map(row => headers.map(h => String(row[h] || '')).join(';'))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <PageLoader />;

  const colors = {
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    indigo: '#6366f1',
    teal: '#14b8a6'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raporty i analityka</h1>
          <p className="text-gray-500 text-sm mt-1">Kompleksowa analiza majątku firmy</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Całkowita wartość majątku</p>
              <p className="text-2xl font-bold text-gray-900">{totalValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Wartość przypisana pracownikom</p>
              <p className="text-2xl font-bold text-gray-900">{assignedValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Nieprzypisany majątek</p>
              <p className="text-2xl font-bold text-gray-900">{unassignedValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Koszty napraw</p>
              <p className="text-2xl font-bold text-gray-900">{totalRepairCosts.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Value Assets */}
        <Card>
          <CardHeader
            title="Najbardziej wartościowy sprzęt"
            action={
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => exportToCSV(topValueAssets.map(a => ({
                  Nazwa: a.name,
                  Kategoria: a.category?.name || '-',
                  Cena: a.purchase_price || 0,
                  Producent: a.manufacturer || '-',
                  Model: a.model || '-'
                })), 'wartosciowy_sprzet')}
              >
                Eksport
              </Button>
            }
          />
          <div className="space-y-1">
            {topValueAssets.map((asset, i) => (
              <ChartBar
                key={asset.id}
                label={asset.name}
                sublabel={`${asset.manufacturer || ''} ${asset.model || ''}`.trim()}
                value={asset.purchase_price || 0}
                max={topValueAssets[0]?.purchase_price || 1}
                color={i === 0 ? colors.green : i === 1 ? colors.blue : i === 2 ? colors.purple : '#9ca3af'}
              />
            ))}
          </div>
        </Card>

        {/* Purchases by Year */}
        <Card>
          <CardHeader
            title="Zakupy sprzętu na przestrzeni lat"
            action={
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => exportToCSV(sortedYears.map(y => ({
                  Rok: y,
                  'Liczba zakupów': purchasesByYear[y],
                  'Wartość': assets.filter(a => a.purchase_date && parseISO(a.purchase_date).getFullYear() === y)
                    .reduce((sum, a) => sum + (a.purchase_price || 0), 0)
                })), 'zakupy_lata')}
              >
                Eksport
              </Button>
            }
          />
          {sortedYears.length > 0 ? (
            <div className="space-y-1">
              {sortedYears.map(year => {
                const yearValue = assets
                  .filter(a => a.purchase_date && parseISO(a.purchase_date).getFullYear() === year)
                  .reduce((sum, a) => sum + (a.purchase_price || 0), 0);
                const maxValue = Math.max(...sortedYears.map(y =>
                  assets.filter(a => a.purchase_date && parseISO(a.purchase_date).getFullYear() === y)
                    .reduce((sum, a) => sum + (a.purchase_price || 0), 0)
                ), 1);
                return (
                  <ChartBar
                    key={year}
                    label={year.toString()}
                    sublabel={`${purchasesByYear[year]} szt.`}
                    value={yearValue}
                    max={maxValue}
                    color={colors.blue}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Brak danych o zakupach</p>
          )}
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Distribution */}
        <Card>
          <CardHeader title="Rozkład kategorii" />
          {categoryData.length > 0 ? (
            <PieChartVisual data={categoryData} />
          ) : (
            <p className="text-gray-500 text-sm">Brak danych</p>
          )}
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader title="Rozkład statusów" />
          {statusData.length > 0 ? (
            <PieChartVisual data={statusData} />
          ) : (
            <p className="text-gray-500 text-sm">Brak danych</p>
          )}
        </Card>

        {/* Purchases this year by month */}
        <Card>
          <CardHeader title={`Zakupy w ${currentYear} r.`} />
          <div className="space-y-2">
            {monthNames.map((month, i) => (
              <div key={month} className="flex items-center gap-2">
                <span className="w-10 text-xs text-gray-500">{month}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${maxMonthPurchases > 0 ? ((purchasesByMonth[i] || 0) / maxMonthPurchases) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-gray-600 text-right">{purchasesByMonth[i] || 0}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Warranty Ending Soon */}
        <Card>
          <CardHeader
            title="Kończące się gwarancje (90 dni)"
            action={
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => exportToCSV(warrantyEndingSoon.map(a => ({
                  Nazwa: a.name,
                  'Nr inwentarzowy': a.inventory_number || a.asset_tag || '-',
                  'Koniec gwarancji': a.warranty_end_date || '-',
                  'Dni do końca': a.warranty_end_date ? differenceInDays(parseISO(a.warranty_end_date), new Date()) : '-'
                })), 'gwarancje')}
              >
                Eksport
              </Button>
            }
          />
          <div className="divide-y">
            {warrantyEndingSoon.length > 0 ? warrantyEndingSoon.map(asset => {
              const daysLeft = asset.warranty_end_date ? differenceInDays(parseISO(asset.warranty_end_date), new Date()) : null;
              const isExpired = daysLeft !== null && daysLeft < 0;
              const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
              return (
                <div key={asset.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{asset.name}</p>
                    <p className="text-sm text-gray-500">{asset.inventory_number || asset.asset_tag}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${isExpired ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-gray-900'}`}>
                      {asset.warranty_end_date ? format(parseISO(asset.warranty_end_date), 'dd.MM.yyyy') : '-'}
                    </p>
                    <p className={`text-xs ${isExpired ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-gray-400'}`}>
                      {isExpired ? 'Wygasła' : daysLeft !== null ? `${daysLeft} dni` : '-'}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <p className="py-4 text-center text-gray-500">Brak sprzętu z kończącymi się gwarancjami</p>
            )}
          </div>
        </Card>

        {/* Repair History */}
        <Card>
          <CardHeader
            title="Najczęściej naprawiany sprzęt"
            action={
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => exportToCSV(mostRepairedAssets.map(r => ({
                  Nazwa: r.asset?.name || '-',
                  'Nr inwentarzowy': r.asset?.inventory_number || '-',
                  'Liczba napraw': r.count,
                  'Łączny koszt': repairs.filter(rep => rep.asset_id === r.asset?.id).reduce((sum, rep) => sum + (rep.cost || 0), 0)
                })), 'naprawy_sprzet')}
              >
                Eksport
              </Button>
            }
          />
          <div className="divide-y">
            {mostRepairedAssets.length > 0 ? mostRepairedAssets.map(r => {
              const totalCost = repairs.filter(rep => rep.asset_id === r.asset?.id).reduce((sum, rep) => sum + (rep.cost || 0), 0);
              return (
                <div key={r.asset?.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{r.asset?.name}</p>
                    <p className="text-sm text-gray-500">{r.asset?.inventory_number || r.asset?.asset_tag}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{r.count} napraw</p>
                    <p className="text-sm text-gray-500">{totalCost.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
                  </div>
                </div>
              );
            }) : (
              <p className="py-4 text-center text-gray-500">Brak zarejestrowanych napraw</p>
            )}
          </div>
        </Card>
      </div>

      {/* Assets by Location */}
      <Card>
        <CardHeader
          title="Sprzęt według lokalizacji"
          action={
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => exportToCSV(locations.map(loc => ({
                Lokalizacja: loc.name,
                'Liczba sprzętów': assets.filter(a => a.location_id === loc.id).length,
                'Wartość': assets.filter(a => a.location_id === loc.id).reduce((sum, a) => sum + (a.purchase_price || 0), 0)
              })), 'raport_lokalizacje')}
            >
              Eksport CSV
            </Button>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map(loc => {
            const locAssets = assets.filter(a => a.location_id === loc.id);
            const locValue = locAssets.reduce((sum, a) => sum + (a.purchase_price || 0), 0);
            return (
              <div key={loc.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{loc.name}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Sztuk:</span>
                  <span className="font-medium">{locAssets.length}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Wartość:</span>
                  <span className="font-medium">{locValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Asset by Employee */}
      <Card>
        <CardHeader
          title="Sprzęt według pracowników"
          action={
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => exportToCSV(employees.map(emp => {
                const empAssets = assets.filter(a => a.assigned_to === emp.id);
                return {
                  Pracownik: `${emp.first_name} ${emp.last_name}`,
                  Dział: emp.department || '-',
                  'Liczba sprzętów': empAssets.length,
                  Wartość: empAssets.reduce((sum, a) => sum + (a.purchase_price || 0), 0)
                };
              }), 'raport_pracownicy')}
            >
              Eksport CSV
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-2 font-medium">Pracownik</th>
                <th className="pb-2 font-medium">Dział</th>
                <th className="pb-2 font-medium text-right">Sprzętów</th>
                <th className="pb-2 font-medium text-right">Wartość</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map(emp => {
                const empAssets = assets.filter(a => a.assigned_to === emp.id);
                const empValue = empAssets.reduce((sum, a) => sum + (a.purchase_price || 0), 0);
                return (
                  <tr key={emp.id}>
                    <td className="py-2">{emp.first_name} {emp.last_name}</td>
                    <td className="py-2 text-gray-500">{emp.department || '-'}</td>
                    <td className="py-2 text-right font-medium">{empAssets.length}</td>
                    <td className="py-2 text-right">{empValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
