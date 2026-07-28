import { useEffect, useRef } from 'react';
import { useAuth } from '@/auth/SessionProvider';
import { useData } from './DataProvider';

/**
 * Carga inicial dos dados, disparada uma vez quando a sessão fica pronta:
 *
 *  1. as entregas gravadas no Supabase (o checkpoint de quem parou no meio);
 *  2. o catálogo completo — empreendimentos e, para cada um, suas unidades.
 *
 * O passo 2 roda em segundo plano e em série: são consultas pesadas à view do
 * Mega, e dispará-las todas de uma vez competiria com a navegação de quem
 * acabou de entrar. Em série elas chegam uma a uma, o dashboard vai somando os
 * números conforme cada empreendimento responde, e o cache local fica quente —
 * então abrir a listagem de unidades depois não espera nada.
 *
 * Mora aqui, e não no `DataProvider`, porque depende do usuário autenticado e o
 * `SessionProvider` é filho do provider de dados. Renderiza `null`.
 */
export function CarregarPersistidos(): null {
  const { status } = useAuth();
  const { actions } = useData();
  const { carregarPersistidos, garantirEmpreendimentos, garantirUnidades } = actions;
  const jaRodou = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || jaRodou.current) return;
    jaRodou.current = true;
    let ativo = true;

    void carregarPersistidos().catch((e: unknown) =>
      console.warn('[bootstrap] entregas salvas:', e),
    );

    void (async () => {
      try {
        const lista = await garantirEmpreendimentos();
        for (const emp of lista) {
          if (!ativo) return;
          // Uma falha isolada (empreendimento sem contrato no Mega, timeout) não
          // pode interromper a varredura dos demais.
          await garantirUnidades(emp).catch((e: unknown) =>
            console.warn(`[bootstrap] unidades de ${emp.nome}:`, e),
          );
        }
      } catch (e) {
        console.warn('[bootstrap] catálogo de empreendimentos:', e);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [status, carregarPersistidos, garantirEmpreendimentos, garantirUnidades]);

  return null;
}
