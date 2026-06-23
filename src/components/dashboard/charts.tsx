import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  type PieLabelRenderProps,
} from 'recharts';

/**
 * Blocos de gráfico do dashboard, seguindo o design system (graficos.md):
 * wrapper `rounded-xl border bg-card`, tooltip Tipo A custom, donut com label
 * percentual branco dentro da fatia e total no centro.
 */

export interface FatiaDado {
  name: string;
  value: number;
  color: string;
}

/** Card-wrapper padrão de gráfico. */
export function ChartCard({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{titulo}</h3>
      {children}
    </div>
  );
}

interface TipItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { color?: string };
}

/** Tooltip custom (Tipo A do design system). Serve donut e barras. */
function ChartTip({ active, payload }: { active?: boolean; payload?: TipItem[] }): React.JSX.Element | null {
  if (!active || !payload?.length) return null;
  const itens = payload.filter((p) => Number(p.value) > 0);
  if (itens.length === 0) return null;
  return (
    <div className="min-w-[160px] space-y-1.5 rounded-xl border border-border bg-card p-3 text-xs shadow-lg">
      {itens.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: p.color ?? p.payload?.color }}
          />
          <span className="truncate text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderSliceLabel(props: PieLabelRenderProps): React.ReactNode {
  const percent = Number(props.percent ?? 0);
  if (percent < 0.08) return null; // esconde fatias muito pequenas
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const inner = Number(props.innerRadius ?? 0);
  const outer = Number(props.outerRadius ?? 0);
  const RADIAN = Math.PI / 180;
  const radius = inner + (outer - inner) / 2;
  const x = cx + radius * Math.cos(-Number(props.midAngle ?? 0) * RADIAN);
  const y = cy + radius * Math.sin(-Number(props.midAngle ?? 0) * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

/** Donut com total no centro. `data` já deve vir filtrado (sem zeros). */
export function Donut({
  data,
  total,
  legenda,
}: {
  data: FatiaDado[];
  total: number;
  legenda: string;
}): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Sem dados
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <RTooltip content={<ChartTip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              label={renderSliceLabel}
              labelLine={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} stroke="transparent" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">{total}</span>
          <span className="text-[11px] text-muted-foreground">{legenda}</span>
        </div>
      </div>
      {/* Legenda */}
      <ul className="flex w-full flex-col gap-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarSerie {
  key: string;
  color: string;
}

/** Barras horizontais empilhadas (ex.: unidades por empreendimento, por status). */
export function HorizontalStackedBar({
  rows,
  series,
  categoryKey,
  height = 220,
}: {
  rows: Array<Record<string, string | number>>;
  series: BarSerie[];
  categoryKey: string;
  height?: number;
}): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={rows}
        margin={{ top: 5, right: 16, left: 10, bottom: 5 }}
        barCategoryGap="28%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey={categoryKey}
          tick={{ fontSize: 12, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          width={160}
        />
        <RTooltip content={<ChartTip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="s"
            fill={s.color}
            maxBarSize={34}
            radius={i === series.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
