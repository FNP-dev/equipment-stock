import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DashboardStats, Asset, AssetHistory, Asset as AssetType } from '../lib/types';
import Card, { CardHeader } from '../components/Card';
import { PageLoader } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, Users, MapPin, AlertTriangle,
  TrendingUp, Clock, Plus, ArrowRight,
  Laptop, Monitor, Smartphone, Printer, Tablet
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function DashboardPage() {
  const { isManagerOrAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);
  const [recentActivity, setRecentActivity] = useState<AssetHistory[]>([]);
  const [warrantyEnding, setWarrantyEnding] = useState<Asset[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const [
        assetsResult,
        employeesResult,
        locationsResult,
        recentAssetsResult,
        recentActivityResult
      ] = await Promise.all([
        supabase.from('assets').select('*, status:statuses(*), category:categories(*)'),
        supabase.from('employees').select('id', { count: 'exact', head: true }),
        supabase.from('locations').select('id', { count: 'exact', head: true }),
        supabase.from('assets').select('*, category:categories(*), status:statuses(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('asset_history').select('*, asset:assets(name)').order('performed_at', { ascending: false }).limit(10)
      ]);
console.log('employeesResult', employeesResult.count)
      const assets = assetsResult.data || [];
      const statuses = {
        total: assets.length,
        assigned: assets.filter(a => a.status?.name === 'Przypisany').length,
        available: assets.filter(a => a.status?.name === 'Dostępny').length,
        inService: assets.filter(a => a.status?.name === 'W serwisie').length,
        damaged: assets.filter(a => a.status?.name === 'Uszkodzony').length,
        retired: assets.filter(a => a.status?.name === 'Wycofany').length
      };

      const today = new Date();
      const warrantyEnd = addDays(today, 30);
      const warrantySoon = assets.filter(a => {
        if (!a.warranty_end_date) return false;
        const endDate = new Date(a.warranty_end_date);
        return endDate >= today && endDate <= warrantyEnd;
      });

      setStats({
        totalAssets: statuses.total,
        assignedAssets: statuses.assigned,
        availableAssets: statuses.available,
        inServiceAssets: statuses.inService,
        damagedAssets: statuses.damaged,
        retiredAssets: statuses.retired,
        totalEmployees: employeesResult.count || 0,
        totalLocations: locationsResult.count || 0,
        warrantyEndingSoon: warrantySoon.length
      });

      setRecentAssets(recentAssetsResult.data || []);
      setRecentActivity(recentActivityResult.data || []);
      setWarrantyEnding(warrantySoon);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <PageLoader />;

  const statCards = [
    { label: 'Wszystkie zasoby', value: stats?.totalAssets || 0, icon: Package, color: 'blue' },
    { label: 'Przypisane', value: stats?.assignedAssets || 0, icon: Users, color: 'green' },
    { label: 'Dostępne', value: stats?.availableAssets || 0, icon: Package, color: 'emerald' },
    { label: 'W serwisie', value: stats?.inServiceAssets || 0, icon: Clock, color: 'yellow' },
  ];

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Przegląd zasobów firmy</p>
        </div>
        {isManagerOrAdmin && (
          <Link
            to="/assets/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Dodaj sprzęt
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const color = colorClasses[stat.color as keyof typeof colorClasses];
          return (
            <Card key={stat.label}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${colorClasses.red} flex items-center justify-center`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.damagedAssets || 0}</p>
              <p className="text-sm text-gray-500">Uszkodzone</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${colorClasses.purple} flex items-center justify-center`}>
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.warrantyEndingSoon || 0}</p>
              <p className="text-sm text-gray-500">Gwarancje kończą się</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${colorClasses.green} flex items-center justify-center`}>
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalEmployees || 0}</p>
              <p className="text-sm text-gray-500">Pracowników</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${colorClasses.blue} flex items-center justify-center`}>
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalLocations || 0}</p>
              <p className="text-sm text-gray-500">Lokalizacji</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Assets */}
        <Card>
          <CardHeader
            title="Ostatnio dodane"
            action={
              <Link to="/assets" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                Zobacz wszystkie <ArrowRight className="w-4 h-4" />
              </Link>
            }
          />
          <div className="space-y-3">
            {recentAssets.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Brak sprzętu</p>
            ) : (
              recentAssets.map((asset) => (
                <Link
                  key={asset.id}
                  to={`/assets/${asset.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                    <p className="text-xs text-gray-500">
                      {asset.category?.name || 'Bez kategorii'} • {asset.asset_tag || 'Brak tagu'}
                    </p>
                  </div>
                  <span
                    className="px-2 py-1 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: asset.status?.color ? `${asset.status.color}20` : '#f3f4f6',
                      color: asset.status?.color || '#6b7280'
                    }}
                  >
                    {asset.status?.name || 'Bez statusu'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader title="Ostatnia aktywność" />
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Brak aktywności</p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.action}</span>
                      {activity.asset && <span className="text-gray-500"> - {activity.asset.name}</span>}
                    </p>
                    {activity.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(activity.performed_at), 'dd MMM yyyy, HH:mm', { locale: pl })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Warranty Warning */}
      {warrantyEnding.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader
            title="Kończące się gwarancje"
            subtitle={`${warrantyEnding.length} urządzeń ma gwarancję kończącą się w ciągu 30 dni`}
            action={
              <Link to="/reports?filter=warranty" className="text-sm text-amber-700 hover:underline">
                Zobacz raport
              </Link>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {warrantyEnding.slice(0, 6).map((asset) => {
              const daysLeft = differenceInDays(new Date(asset.warranty_end_date!), new Date());
              return (
                <div key={asset.id} className="p-3 bg-white rounded-lg border border-amber-200">
                  <p className="text-sm font-medium text-gray-900">{asset.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{asset.asset_tag || 'Bez tagu'}</p>
                  <p className="text-xs text-amber-600 font-medium mt-2">
                    {daysLeft} dni do końca gwarancji
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
