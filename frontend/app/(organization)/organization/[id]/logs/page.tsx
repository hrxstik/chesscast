'use client';

import { useEffect, useState } from 'react';
import { Section } from '@/components/ui/section';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgSubNav } from '@/components/organization/org-sub-nav';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { fetchOrganizationLogs, type OrganizationLogDto } from '@/lib/api/organizations';
import { ApiError } from '@/lib/api/types';

type Props = { params: Promise<{ id: string }> };

export default function OrganizationLogsPage({ params }: Props) {
  const [id, setId] = useState('');
  const [rows, setRows] = useState<OrganizationLogDto[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load(orgId: number, type?: string) {
    try {
      const logs = await fetchOrganizationLogs(orgId, { type: type || undefined, limit: 200 });
      setRows(logs);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить журнал');
    }
  }

  useEffect(() => {
    (async () => {
      const p = await params;
      setId(p.id);
      await load(Number(p.id), typeFilter);
    })();
  }, [params, typeFilter]);

  function onExportCsv() {
    const header = ['type', 'createdAt'];
    const body = rows.map((r) => [r.type, r.createdAt]);
    const csv = [header, ...body]
      .map((line) => line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organization-${id}-logs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section>
      <OrgSubNav orgId={id} />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <H1>Журнал событий</H1>
          <Text className="mt-2 text-muted-foreground">Организация #{id}. История ключевых событий.</Text>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Все типы</option>
            <option value="ORGANIZATION_CREATED">ORGANIZATION_CREATED</option>
            <option value="GAME_CREATED">GAME_CREATED</option>
          </select>
          <Button variant="outline" className="gap-2" onClick={onExportCsv}>
            <Download className="size-4" aria-hidden />
            Экспорт CSV
          </Button>
        </div>
      </div>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      <Card className="mt-8 overflow-hidden border-border/80">
        <CardHeader className="border-b border-border bg-muted/30">
          <CardTitle className="text-base">События</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Событие</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Актор</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/80 last:border-0">
                    <td className="px-4 py-3">{row.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">—</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-muted-foreground" colSpan={3}>
                      Событий пока нет
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}
