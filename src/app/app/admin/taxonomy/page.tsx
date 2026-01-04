import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/formatters';

type ContestTag = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ContestTerm = {
  id: string;
  version: string;
  terms_url: string | null;
  is_active: boolean;
  created_at: string;
  markdown_preview: string | null;
};

type ContestAsset = {
  id: string;
  contest_id: string;
  url: string;
  type: string;
  created_at: string;
  contest: { id: string; title: string; brand_id: string } | null;
};

type Asset = {
  id: string;
  bucket: string;
  path: string;
  visibility: string;
  moderation_status: string;
  size_bytes: number | null;
  created_at: string;
  owner_id: string | null;
  org_id: string | null;
  owner: { id: string; display_name: string | null; email: string } | null;
  org: { id: string; name: string | null } | null;
};

type Paged<T> = { items: T[]; pagination: { total: number; page: number; limit: number } };

export default async function AdminTaxonomyPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await requireAdminPermission('taxonomy.read');
  } catch {
    redirect('/forbidden');
  }

  const tagQ = typeof searchParams.tag_q === 'string' ? searchParams.tag_q : '';
  const tagActive = typeof searchParams.tag_active === 'string' ? searchParams.tag_active : '';

  const termsQ = typeof searchParams.terms_q === 'string' ? searchParams.terms_q : '';
  const termsActive =
    typeof searchParams.terms_active === 'string' ? searchParams.terms_active : '';

  const cAssetType =
    typeof searchParams.casset_type === 'string' ? searchParams.casset_type : '';
  const cAssetContestId =
    typeof searchParams.casset_contest_id === 'string' ? searchParams.casset_contest_id : '';
  const cAssetQ = typeof searchParams.casset_q === 'string' ? searchParams.casset_q : '';

  const assetBucket = typeof searchParams.asset_bucket === 'string' ? searchParams.asset_bucket : '';
  const assetVisibility =
    typeof searchParams.asset_visibility === 'string' ? searchParams.asset_visibility : '';
  const assetModeration =
    typeof searchParams.asset_moderation === 'string' ? searchParams.asset_moderation : '';
  const assetQ = typeof searchParams.asset_q === 'string' ? searchParams.asset_q : '';

  const [tagsRes, termsRes, contestAssetsRes, assetsRes] = await Promise.all([
    fetchAdminApi(
      `/api/admin/contest-tags?${new URLSearchParams({
        ...(tagQ ? { q: tagQ } : {}),
        ...(tagActive ? { is_active: tagActive } : {}),
        page: '1',
        limit: '50',
      }).toString()}`,
      { cache: 'no-store' }
    ),
    fetchAdminApi(
      `/api/admin/contest-terms?${new URLSearchParams({
        ...(termsQ ? { q: termsQ } : {}),
        ...(termsActive ? { is_active: termsActive } : {}),
        page: '1',
        limit: '20',
      }).toString()}`,
      { cache: 'no-store' }
    ),
    fetchAdminApi(
      `/api/admin/contest-assets?${new URLSearchParams({
        ...(cAssetType ? { type: cAssetType } : {}),
        ...(cAssetContestId ? { contest_id: cAssetContestId } : {}),
        ...(cAssetQ ? { q: cAssetQ } : {}),
        page: '1',
        limit: '20',
      }).toString()}`,
      { cache: 'no-store' }
    ),
    fetchAdminApi(
      `/api/admin/assets?${new URLSearchParams({
        ...(assetBucket ? { bucket: assetBucket } : {}),
        ...(assetVisibility ? { visibility: assetVisibility } : {}),
        ...(assetModeration ? { moderation_status: assetModeration } : {}),
        ...(assetQ ? { q: assetQ } : {}),
        page: '1',
        limit: '20',
      }).toString()}`,
      { cache: 'no-store' }
    ),
  ]);

  const tags: Paged<ContestTag> = tagsRes.ok
    ? await tagsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 50 } };
  const terms: Paged<ContestTerm> = termsRes.ok
    ? await termsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };
  const contestAssets: Paged<ContestAsset> = contestAssetsRes.ok
    ? await contestAssetsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };
  const assets: Paged<Asset> = assetsRes.ok
    ? await assetsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };

  return (
    <section className="space-y-10">
      <div>
        <h1 className="display-2">Tags / Conditions / Médias</h1>
        <p className="text-muted-foreground text-sm">Taxonomie concours + assets (médias) + stockage.</p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tags concours</h2>
          <p className="text-muted-foreground text-sm">{tags.pagination.total} tags</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="tag_q">
                Recherche
              </label>
              <input
                id="tag_q"
                name="tag_q"
                defaultValue={tagQ}
                placeholder="name / slug"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="tag_active">
                Actif
              </label>
              <select
                id="tag_active"
                name="tag_active"
                defaultValue={tagActive || ''}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Tous</option>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary">
                Filtrer
              </Button>
            </div>
          </AdminFilters>
        </form>

        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tag</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Actif</th>
              <th className="px-4 py-3">Mis à jour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {tags.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun tag
                </td>
              </tr>
            ) : (
              tags.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-medium flex items-center gap-2">
                      {item.color ? (
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-border"
                          style={{ background: item.color }}
                        />
                      ) : null}
                      {item.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.description || '-'}</div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{item.slug}</td>
                  <td className="px-4 py-4">
                    <Badge variant={item.is_active ? 'success' : 'secondary'}>
                      {item.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Conditions concours</h2>
          <p className="text-muted-foreground text-sm">{terms.pagination.total} versions</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="terms_q">
                Recherche
              </label>
              <input
                id="terms_q"
                name="terms_q"
                defaultValue={termsQ}
                placeholder="version / url"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="terms_active">
                Actif
              </label>
              <select
                id="terms_active"
                name="terms_active"
                defaultValue={termsActive || ''}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Tous</option>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary">
                Filtrer
              </Button>
            </div>
          </AdminFilters>
        </form>

        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Actif</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {terms.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Aucune condition
                </td>
              </tr>
            ) : (
              terms.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-medium">{item.version}</div>
                    <div className="text-xs text-muted-foreground">{item.markdown_preview || '-'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={item.is_active ? 'success' : 'secondary'}>
                      {item.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {item.terms_url ? (
                      <a href={item.terms_url} target="_blank" rel="noreferrer" className="text-primary underline">
                        Ouvrir
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Assets concours (table)</h2>
          <p className="text-muted-foreground text-sm">{contestAssets.pagination.total} assets</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="casset_q">
                Recherche
              </label>
              <input
                id="casset_q"
                name="casset_q"
                defaultValue={cAssetQ}
                placeholder="url"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <AdminEntitySelect
              kind="contest"
              name="casset_contest_id"
              label="Concours"
              placeholder="Rechercher un concours..."
              defaultValue={cAssetContestId || undefined}
            />
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="casset_type">
                Type
              </label>
              <select
                id="casset_type"
                name="casset_type"
                defaultValue={cAssetType || ''}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Tous</option>
                <option value="image">image</option>
                <option value="video">video</option>
                <option value="pdf">pdf</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary">
                Filtrer
              </Button>
            </div>
          </AdminFilters>
        </form>

        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Contest</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {contestAssets.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun asset
                </td>
              </tr>
            ) : (
              contestAssets.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <a href={item.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
                      Ouvrir l'URL
                    </a>
                    <div className="text-xs text-muted-foreground">{item.id}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium">{item.contest?.title || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{item.contest_id}</div>
                    {item.contest?.id ? (
                      <div className="mt-2">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/app/admin/contests/${item.contest.id}`}>Voir concours</Link>
                        </Button>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{item.type}</td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Assets storage (métadonnées)</h2>
          <p className="text-muted-foreground text-sm">{assets.pagination.total} rows</p>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="asset_q">
                Recherche
              </label>
              <input
                id="asset_q"
                name="asset_q"
                defaultValue={assetQ}
                placeholder="path / bucket"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="asset_bucket">
                Bucket
              </label>
              <input
                id="asset_bucket"
                name="asset_bucket"
                defaultValue={assetBucket}
                placeholder="avatars, contest_assets..."
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="asset_visibility">
                Visibility
              </label>
              <select
                id="asset_visibility"
                name="asset_visibility"
                defaultValue={assetVisibility || ''}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="private">private</option>
                <option value="public">public</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="asset_moderation">
                Moderation
              </label>
              <select
                id="asset_moderation"
                name="asset_moderation"
                defaultValue={assetModeration || ''}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary">
                Filtrer
              </Button>
            </div>
          </AdminFilters>
        </form>

        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Propriétaire / org</th>
              <th className="px-4 py-3">Visibility</th>
              <th className="px-4 py-3">Moderation</th>
              <th className="px-4 py-3">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {assets.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun asset
                </td>
              </tr>
            ) : (
              assets.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-medium">
                      {item.bucket}/{item.path}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.size_bytes ? `${Math.round(item.size_bytes / 1024)} KB` : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    <div>{item.owner?.email || item.owner_id || '-'}</div>
                    <div>{item.org?.name || item.org_id || '-'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={item.visibility === 'public' ? 'info' : 'secondary'}>{item.visibility}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      variant={
                        item.moderation_status === 'approved'
                          ? 'success'
                          : item.moderation_status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {item.moderation_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </div>
    </section>
  );
}
