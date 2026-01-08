import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, Database, Image as ImageIcon, Tag } from 'lucide-react';

import { fetchAdminApi } from '@/lib/admin/request';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminEntitySelect } from '@/components/admin/admin-entity-select';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function SectionHeader({
  icon,
  title,
  subtitle,
  badges,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badges ? <div className="flex items-center gap-2">{badges}</div> : null}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

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

  const activeTags = tags.items.filter((tag) => tag.is_active).length;
  const inactiveTags = tags.items.length - activeTags;
  const activeTerms = terms.items.filter((term) => term.is_active).length;
  const inactiveTerms = terms.items.length - activeTerms;
  const storageBuckets = new Set(assets.items.map((item) => item.bucket)).size;
  const visibilityCounts = assets.items.reduce(
    (acc, item) => {
      if (item.visibility === 'public') acc.public += 1;
      else if (item.visibility === 'private') acc.private += 1;
      return acc;
    },
    { public: 0, private: 0 }
  );
  const moderationCounts = assets.items.reduce(
    (acc, item) => {
      if (item.moderation_status === 'approved') acc.approved += 1;
      else if (item.moderation_status === 'rejected') acc.rejected += 1;
      else acc.pending += 1;
      return acc;
    },
    { approved: 0, rejected: 0, pending: 0 }
  );

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Taxonomy"
        description="Contest tags, legal terms, and asset metadata."
        icon={<Tag className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{tags.pagination.total} tags</Badge>
            <Badge variant="secondary">{terms.pagination.total} terms</Badge>
            <Badge variant="secondary">{assets.pagination.total} assets</Badge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contest tags</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{tags.pagination.total}</div>
            <Badge variant="secondary">{activeTags} active</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contest terms</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{terms.pagination.total}</div>
            <Badge variant="secondary">{activeTerms} active</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contest assets</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{contestAssets.pagination.total}</div>
            <Badge variant="secondary">{contestAssets.items.length} on page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storage assets</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{assets.pagination.total}</div>
            <Badge variant="secondary">{storageBuckets} buckets</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Tag className="h-5 w-5" />}
          title="Contest tags"
          subtitle="Label contests with discovery and filtering metadata."
          badges={
            <>
              <Badge variant="secondary">Active {activeTags}</Badge>
              <Badge variant="secondary">Inactive {inactiveTags}</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="tag_q">
                    Search
                  </label>
                  <input
                    id="tag_q"
                    name="tag_q"
                    defaultValue={tagQ}
                    placeholder="Name or slug"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="tag_active">
                    Status
                  </label>
                  <select
                    id="tag_active"
                    name="tag_active"
                    defaultValue={tagActive || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {tags.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No tags found.
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
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.updated_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<BookOpen className="h-5 w-5" />}
          title="Contest terms"
          subtitle="Track legal versions and active terms used by contests."
          badges={
            <>
              <Badge variant="secondary">Active {activeTerms}</Badge>
              <Badge variant="secondary">Inactive {inactiveTerms}</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="terms_q">
                    Search
                  </label>
                  <input
                    id="terms_q"
                    name="terms_q"
                    defaultValue={termsQ}
                    placeholder="Version or URL"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="terms_active">
                    Status
                  </label>
                  <select
                    id="terms_active"
                    name="terms_active"
                    defaultValue={termsActive || ''}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {terms.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No terms found.
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
                          <a
                            href={item.terms_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Open
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ImageIcon className="h-5 w-5" />}
          title="Contest assets"
          subtitle="Table-level assets linked to contests."
          badges={
            <>
              <Badge variant="secondary">{contestAssets.pagination.total} total</Badge>
              <Badge variant="secondary">{contestAssets.items.length} on page</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="casset_q">
                    Search
                  </label>
                  <input
                    id="casset_q"
                    name="casset_q"
                    defaultValue={cAssetQ}
                    placeholder="URL or asset id"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <AdminEntitySelect
                  kind="contest"
                  name="casset_contest_id"
                  label="Contest"
                  placeholder="Search a contest..."
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
                    <option value="">All</option>
                    <option value="image">image</option>
                    <option value="video">video</option>
                    <option value="pdf">pdf</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary">
                    Apply
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
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {contestAssets.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No contest assets found.
                    </td>
                  </tr>
                ) : (
                  contestAssets.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary underline"
                        >
                          Open asset
                        </a>
                        <div className="text-xs text-muted-foreground">{item.id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{item.contest?.title || 'Unknown contest'}</div>
                        <div className="text-xs text-muted-foreground">{item.contest_id}</div>
                        {item.contest?.id ? (
                          <div className="mt-2">
                            <Button asChild variant="secondary" size="sm">
                              <Link href={`/app/admin/contests/${item.contest.id}`}>View contest</Link>
                            </Button>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{item.type}</td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Database className="h-5 w-5" />}
          title="Storage assets"
          subtitle="Raw storage metadata and moderation state."
          badges={
            <>
              <Badge variant="secondary">Public {visibilityCounts.public}</Badge>
              <Badge variant="secondary">Private {visibilityCounts.private}</Badge>
              <Badge variant="secondary">Approved {moderationCounts.approved}</Badge>
            </>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <form>
              <AdminFilters>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="asset_q">
                    Search
                  </label>
                  <input
                    id="asset_q"
                    name="asset_q"
                    defaultValue={assetQ}
                    placeholder="Path or bucket"
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
                    Apply
                  </Button>
                </div>
              </AdminFilters>
            </form>

            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Owner / Org</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3">Moderation</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {assets.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No storage assets found.
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
                        <Badge variant={item.visibility === 'public' ? 'info' : 'secondary'}>
                          {item.visibility}
                        </Badge>
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
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
