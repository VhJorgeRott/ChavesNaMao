import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fNum } from '@chaves/domain/format';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Blocos do dashboard (handoff "Painel de Unidades & Entregas"): KPI com % e
 * barra, donut SVG com hover sincronizado fatia↔legenda e tabela-gráfico de
 * unidades por empreendimento. Paleta só em tons do laranja da marca.
 */

export const BRAND = '#f29f05';
export const BRAND_DARK = '#b36f00';
export const BRAND_TINT = '#fcdca6';

const n0 = (v: number): string => fNum(v, 0);
/** % inteira; denominador zero → "0%". */
const pctInt = (v: number, base: number): string => (base ? `${Math.round((v / base) * 100)}%` : '0%');

function CardTitulo({ titulo, subtitulo }: { titulo: string; subtitulo?: string }): React.JSX.Element {
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-foreground">{titulo}</h3>
      {subtitulo && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitulo}</p>}
    </div>
  );
}

// --- KPI ---------------------------------------------------------------------

export function KpiCard({
  icon: Icon,
  label,
  value,
  base,
  pctValue = value,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  /** Denominador da % e da barra. */
  base: number;
  /** Numerador da % e da barra, quando difere do valor exibido. */
  pctValue?: number;
  caption: string;
}): React.JSX.Element {
  const pct = pctInt(pctValue, base);
  return (
    <Card className="flex flex-col gap-2.5 rounded-xl px-5 py-[18px]">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
        <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[30px] font-bold leading-none tracking-[-0.5px] tabular-nums text-foreground">
          {n0(value)}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ color: BRAND_DARK, backgroundColor: 'rgba(242,159,5,.15)' }}
        >
          {pct}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: base ? `${Math.min(100, (pctValue / base) * 100)}%` : 0, backgroundColor: BRAND }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </Card>
  );
}

// --- Donut -------------------------------------------------------------------

export interface FatiaDado {
  name: string;
  value: number;
  color: string;
}

const R = 70;
const C = 2 * Math.PI * R;
const EASE = 'all .18s ease';

export function DonutCard({
  titulo,
  subtitulo,
  unidade,
  data,
}: {
  titulo: string;
  subtitulo: string;
  /** Rótulo do centro em repouso ("entregas", "unidades"). */
  unidade: string;
  data: FatiaDado[];
}): React.JSX.Element {
  const [hov, setHov] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const gap = data.filter((d) => d.value > 0).length > 1 ? 2 : 0;
  const pctOf = (v: number): string => (total ? `${Math.round((v / total) * 100)}%` : '-');
  const cur = hov !== null ? data[hov] : null;

  let acc = 0;
  const segs = data.map((d, i) => {
    const len = total ? (d.value / total) * C : 0;
    const seg = { ...d, i, len, offset: -acc };
    acc += len;
    return seg;
  });

  return (
    <Card className="flex flex-col gap-[18px] rounded-xl p-5">
      <CardTitulo titulo={titulo} subtitulo={subtitulo} />
      <div className="flex flex-wrap items-center gap-7">
        <div className="relative h-[180px] w-[180px] shrink-0" onMouseLeave={() => setHov(null)}>
          <svg width={180} height={180} viewBox="0 0 180 180" className="-rotate-90">
            <circle cx={90} cy={90} r={R} fill="none" strokeWidth={24} className="stroke-muted" />
            {segs
              .filter((s) => s.value > 0)
              .map((s) => (
                <circle
                  key={s.name}
                  cx={90}
                  cy={90}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hov === s.i ? 32 : 24}
                  strokeDasharray={`${Math.max(s.len - gap, 0.5)} ${C}`}
                  strokeDashoffset={s.offset}
                  opacity={hov === null || hov === s.i ? 1 : 0.3}
                  style={{ transition: EASE, cursor: 'pointer' }}
                  onMouseEnter={() => setHov(s.i)}
                />
              ))}
          </svg>
          <div className="pointer-events-none absolute inset-10 flex flex-col items-center justify-center text-center">
            <span
              className={cn('text-[30px] font-bold leading-none tabular-nums', !cur && 'text-foreground')}
              style={cur ? { color: BRAND_DARK } : undefined}
            >
              {cur ? pctOf(cur.value) : n0(total)}
            </span>
            <span className="mt-1 max-w-[92px] text-xs text-muted-foreground">{cur ? cur.name : unidade}</span>
          </div>
        </div>

        <ul className="min-w-[200px] flex-1">
          {data.map((d, i) => {
            const on = hov === i;
            return (
              <li
                key={d.name}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
                className="-mx-2 grid cursor-default grid-cols-[10px_1fr_44px_32px] items-center gap-2.5 rounded-lg px-2 py-[7px] text-[13px]"
                style={{
                  transition: EASE,
                  backgroundColor: on ? 'rgba(242,159,5,.10)' : 'transparent',
                  opacity: hov !== null && !on ? 0.45 : 1,
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ backgroundColor: d.color, transform: on ? 'scale(1.3)' : 'none', transition: EASE }}
                />
                <span className={cn(on ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{d.name}</span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">{pctOf(d.value)}</span>
                <span className="text-right font-semibold tabular-nums text-foreground">{n0(d.value)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

// --- Unidades por empreendimento ---------------------------------------------

export interface EmpreendimentoUnidades {
  nome: string;
  /** Vendidas ainda a entregar. */
  vendida: number;
  entregue: number;
}

const COLS = 'grid grid-cols-[200px_minmax(0,1fr)_84px_84px_64px] items-center gap-4';

export function EmpreendimentosChart({ data }: { data: EmpreendimentoUnidades[] }): React.JSX.Element {
  const [mode, setMode] = useState<'abs' | 'pct'>('abs');
  const [showEmpty, setShowEmpty] = useState(false);

  const comDados = data
    .map((d) => ({ ...d, total: d.vendida + d.entregue }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);
  const vazios = data
    .filter((d) => d.vendida + d.entregue === 0)
    .map((d) => d.nome)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const max = Math.max(1, ...comDados.map((d) => d.total));
  const sumV = data.reduce((s, d) => s + d.vendida, 0);
  const sumE = data.reduce((s, d) => s + d.entregue, 0);

  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5">
        <CardTitulo
          titulo="Unidades por empreendimento"
          subtitulo={`${n0(sumV + sumE)} unidades vendidas em ${comDados.length} de ${data.length} empreendimentos`}
        />
        <div className="flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
          {(
            [
              ['abs', 'Quantidade'],
              ['pct', 'Proporção'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                'h-7 rounded-lg px-3 text-[12.5px] font-medium transition-colors',
                mode === id
                  ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08)]'
                  : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-5 px-5 pb-4 text-[12.5px]">
        {[
          { label: 'Entregue', color: BRAND, value: sumE },
          { label: 'Vendida a entregar', color: BRAND_TINT, value: sumV },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: l.color }} />
            <span className="text-muted-foreground">{l.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{n0(l.value)}</span>
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div
            className={cn(
              COLS,
              'whitespace-nowrap border-y border-border bg-muted/50 px-5 py-2 text-[11.5px] font-semibold uppercase tracking-[.4px] text-muted-foreground',
            )}
          >
            <span>Empreendimento</span>
            <span>{mode === 'abs' ? 'Unidades vendidas' : 'Entregues / vendidas'}</span>
            <span className="text-right">A entregar</span>
            <span className="text-right">Entregues</span>
            <span className="text-right">% entr.</span>
          </div>
          {comDados.map((d) => {
            const p = d.entregue / d.total;
            return (
              <div key={d.nome} className={cn(COLS, 'border-b border-muted px-5 py-[9px] text-[13px] hover:bg-muted/40')}>
                <span className="truncate font-medium text-foreground" title={d.nome}>
                  {d.nome}
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3.5 min-w-1 overflow-hidden rounded"
                    style={{
                      width: mode === 'abs' ? `calc((100% - 56px) * ${d.total / max})` : 'calc(100% - 56px)',
                      backgroundColor: BRAND_TINT,
                    }}
                  >
                    <div className="h-full" style={{ width: `${p * 100}%`, backgroundColor: BRAND }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {mode === 'abs' ? n0(d.total) : pctInt(d.entregue, d.total)}
                  </span>
                </div>
                <span className="text-right tabular-nums text-muted-foreground">{n0(d.vendida)}</span>
                <span className="text-right tabular-nums text-muted-foreground">{n0(d.entregue)}</span>
                <span
                  className="text-right font-semibold tabular-nums"
                  style={{ color: p > 0 ? BRAND_DARK : '#94a3b8' }}
                >
                  {pctInt(d.entregue, d.total)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {vazios.length > 0 && (
        <div className="flex flex-col gap-3 px-5 py-4">
          <button
            type="button"
            onClick={() => setShowEmpty((v) => !v)}
            aria-expanded={showEmpty}
            className="flex h-[30px] items-center gap-1.5 self-start rounded-lg bg-muted px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-border"
          >
            {showEmpty ? 'Ocultar' : 'Mostrar'} {vazios.length} empreendimentos sem unidades vendidas
            <ChevronDown
              className="h-4 w-4 transition-transform duration-200"
              style={{ transform: showEmpty ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {showEmpty && (
            <div className="flex flex-wrap gap-1.5">
              {vazios.map((nome) => (
                <span key={nome} className="rounded-full border border-border px-2.5 py-[3px] text-xs text-muted-foreground">
                  {nome}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
