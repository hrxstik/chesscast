import { Section } from '@/components/ui/section';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgSubNav } from '@/components/organization/org-sub-nav';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

type Props = { params: Promise<{ id: string }> };

const MOCK_ROWS = [
  { t: 'Игрок присоединился', d: '—' },
  { t: 'Организация обновлена', d: '—' },
  { t: 'Создана игра', d: '—' },
];

export default async function OrganizationLogsPage({ params }: Props) {
  const { id } = await params;

  return (
    <Section>
      <OrgSubNav orgId={id} />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <H1>Журнал событий</H1>
          <Text className="mt-2 text-muted-foreground">
            Организация #{id}. Лента событий с бесконечной подгрузкой — позже.
          </Text>
        </div>
        <Button variant="outline" className="gap-2" disabled>
          <Download className="size-4" aria-hidden />
          Экспорт CSV
        </Button>
      </div>

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
                {MOCK_ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-border/80 last:border-0">
                    <td className="px-4 py-3">{row.t}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.d}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}
