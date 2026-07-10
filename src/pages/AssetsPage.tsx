import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Asset, Category, Location, Status, Employee } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import EmptyState from '../components/EmptyState';
import { PageLoader } from '../components/Loading';
import {
  Package, Plus, Search, FilterX, Edit, Eye, Trash2,
  ChevronLeft, ChevronRight, ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function AssetsPage() {
  const { isManagerOrAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '');
  const [employeeFilter, setEmployeeFilter] = useState(searchParams.get('employee') || '');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('locations').select('*').eq('is_active', true).order('name'),
      supabase.from('statuses').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('employees').select('*').eq('is_active', true).order('first_name')
    ]).then(([catRes, locRes, statRes, empRes]) => {
      setCategories(catRes.data || []);
      setLocations(locRes.data || []);
      setStatuses(statRes.data || []);
      setEmployees(empRes.data || []);
    });
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [search, categoryFilter, statusFilter, locationFilter, employeeFilter, sortBy, sortDir, page]);

  async function fetchAssets() {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('assets')
        .select('*, category:categories(*), location:locations(*), status:statuses(*), employee:employees(*)', { count: 'exact' })
        .eq('is_active', true)
        .range(from, to);

      if (search) {
        query = query.or(`name.ilike.%${search}%,serial_number.ilike.%${search}%,asset_tag.ilike.%${search}%,manufacturer.ilike.%${search}%`);
      }
      if (categoryFilter) query = query.eq('category_id', categoryFilter);
      if (statusFilter) query = query.eq('status_id', statusFilter);
      if (locationFilter) query = query.eq('location_id', locationFilter);
      if (employeeFilter) query = query.eq('assigned_to', employeeFilter);

      query = query.order(sortBy, { ascending: sortDir === 'asc' });

      const { data, count, error } = await query;
      if (error) throw error;

      setAssets(data || []);
      setTotalPages(Math.ceil((count || 0) / pageSize));
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('');
    setLocationFilter('');
    setEmployeeFilter('');
    setSearchParams({});
  }

  async function handleDelete(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć ten sprzęt?')) return;
    try {
      await supabase.from('assets').update({ is_active: false }).eq('id', id);
      fetchAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  }

  const hasActiveFilters = search || categoryFilter || statusFilter || locationFilter || employeeFilter;

  if (loading && assets.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sprzęt</h1>
          <p className="text-gray-500 text-sm mt-1">Zarządzanie zasobami firmy</p>
        </div>
        {isManagerOrAdmin && (
          <Link to="/assets/new">
            <Button icon={<Plus className="w-4 h-4" />}>Dodaj sprzęt</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Szukaj..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Select
            options={categories.map(c => ({ value: c.id, label: c.name }))}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="Wszystkie kategorie"
          />

          <Select
            options={statuses.map(s => ({ value: s.id, label: s.name }))}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Wszystkie statusy"
          />

          <Select
            options={locations.map(l => ({ value: l.id, label: l.name }))}
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="Wszystkie lokalizacje"
          />

          <Select
            options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            placeholder="Wszyscy pracownicy"
          />

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} icon={<FilterX className="w-4 h-4" />}>
              Wyczyść
            </Button>
          )}
        </div>
      </Card>

      {/* Assets Table */}
      <Card padding="none">
        {assets.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8 text-gray-400" />}
            title="Brak sprzętu"
            description={hasActiveFilters ? 'Nie znaleziono sprzętu spełniającego kryteria' : 'Dodaj pierwszy sprzęt do ewidencji'}
            action={isManagerOrAdmin && !hasActiveFilters ? (
              <Link to="/assets/new">
                <Button icon={<Plus className="w-4 h-4" />}>Dodaj sprzęt</Button>
              </Link>
            ) : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-gray-700">
                        Nazwa <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategoria</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Przypisany do</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lokalizacja</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 hover:text-gray-700">
                        Dodano <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{asset.name}</p>
                        {asset.manufacturer && (
                          <p className="text-xs text-gray-500">{asset.manufacturer} {asset.model}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 font-mono">{asset.asset_tag || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{asset.category?.name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {asset.status && (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: asset.status.color ? `${asset.status.color}20` : '#f3f4f6',
                              color: asset.status.color || '#6b7280'
                            }}
                          >
                            {asset.status.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {asset.employee ? (
                          <span className="text-sm text-gray-600">
                            {asset.employee.first_name} {asset.employee.last_name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{asset.location?.name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">
                          {format(new Date(asset.created_at), 'dd.MM.yyyy')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/assets/${asset.id}`}>
                            <Button variant="ghost" size="sm" icon={<Eye className="w-4 h-4" />} />
                          </Link>
                          {isManagerOrAdmin && (
                            <>
                              <Link to={`/assets/${asset.id}/edit`}>
                                <Button variant="ghost" size="sm" icon={<Edit className="w-4 h-4" />} />
                              </Link>
                              <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4 text-red-500" />} onClick={() => handleDelete(asset.id)} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-500">
                  Strona {page} z {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    icon={<ChevronLeft className="w-4 h-4" />}
                  >
                    Poprzednia
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    icon={<ChevronRight className="w-4 h-4" />}
                  >
                    Następna
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
