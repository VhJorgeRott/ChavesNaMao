// Supabase Edge Function (Deno) — gera o PDF de um termo da entrega.
//
// Recebe POST { entregaId, tipo }, monta o documento a partir do MODELO GRAVADO
// NO BANCO e dos dados já persistidos da entrega, sobe o PDF num bucket privado
// e devolve o caminho e o sha256 REAL do arquivo.
//
// Por que server-side: este é o texto que o cliente assina. Se o navegador
// mandasse o conteúdo pronto, quem controlasse o cliente escolheria o que vai
// para a assinatura. Aqui, a única entrada é o id da entrega.
//
// Deploy:
//   supabase functions deploy gerar-termo-pdf
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { renderTermo, variaveisVazias, type ContextoTermo } from '../_shared/termo.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

const BUCKET = 'documentos';

// --- Layout ----------------------------------------------------------------
const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 56; // ~2 cm
const TAMANHO = 10;
const ENTRELINHA = 14;
const LARGURA_UTIL = A4.largura - MARGEM * 2;

/**
 * Quebra o parágrafo em linhas que cabem na largura útil, medindo com a fonte
 * real — `pdf-lib` não quebra texto sozinho. Palavras maiores que a linha
 * inteira (URLs, números longos) são cortadas para não estourar a margem.
 */
function quebrarLinhas(
  texto: string,
  fonte: { widthOfTextAtSize(t: string, s: number): number },
): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split('\n')) {
    if (paragrafo.trim() === '') {
      linhas.push('');
      continue;
    }
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/)) {
      const tentativa = atual === '' ? palavra : `${atual} ${palavra}`;
      if (fonte.widthOfTextAtSize(tentativa, TAMANHO) <= LARGURA_UTIL) {
        atual = tentativa;
        continue;
      }
      if (atual !== '') linhas.push(atual);
      // Palavra sozinha maior que a linha: corta em pedaços que caibam.
      let resto = palavra;
      while (fonte.widthOfTextAtSize(resto, TAMANHO) > LARGURA_UTIL) {
        let corte = resto.length;
        while (corte > 1 && fonte.widthOfTextAtSize(resto.slice(0, corte), TAMANHO) > LARGURA_UTIL) {
          corte -= 1;
        }
        linhas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      atual = resto;
    }
    linhas.push(atual);
  }
  return linhas;
}

/**
 * Substitui o que a fonte padrão (WinAnsi) não codifica. Sem isto, um caractere
 * fora da tabela derruba a geração inteira com erro de encoding — e termo
 * jurídico costuma trazer travessão e aspas tipográficas coladas do Word.
 */
function sanitizar(t: string): string {
  return t
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^\x00-\xFF]/g, '?');
}

async function montarPdf(titulo: string, corpo: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteTitulo = await pdf.embedFont(StandardFonts.HelveticaBold);

  let pagina = pdf.addPage([A4.largura, A4.altura]);
  let y = A4.altura - MARGEM;

  pagina.drawText(sanitizar(titulo), {
    x: MARGEM,
    y,
    size: 13,
    font: fonteTitulo,
    color: rgb(0, 0, 0),
  });
  y -= ENTRELINHA * 2;

  for (const linha of quebrarLinhas(sanitizar(corpo), fonte)) {
    if (y < MARGEM) {
      pagina = pdf.addPage([A4.largura, A4.altura]);
      y = A4.altura - MARGEM;
    }
    if (linha !== '') {
      pagina.drawText(linha, { x: MARGEM, y, size: TAMANHO, font: fonte, color: rgb(0, 0, 0) });
    }
    y -= ENTRELINHA;
  }

  pdf.setTitle(titulo);
  pdf.setProducer('Chaves na Mão — Rottas');
  pdf.setCreationDate(new Date());
  return await pdf.save();
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Autenticação dentro da função (verify_jwt = false no gateway por causa do
  // preflight, mesmo padrão das demais).
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

  let body: { entregaId?: unknown; tipo?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'corpo inválido' }, 400);
  }
  const entregaId = String(body.entregaId ?? '').trim();
  const tipo = String(body.tipo ?? '').trim();
  if (!entregaId || !tipo) return json({ error: 'entregaId e tipo são obrigatórios' }, 400);

  try {
    // Dados da entrega — do BANCO, não do cliente.
    const { data: ent, error: entErr } = await admin
      .from('entregas')
      .select(
        `id, external_ref,
         unidades!inner ( external_ref, identificacao, area_m2,
           empreendimentos!inner ( external_ref, nome, cidade, uf ) ),
         clientes!inner ( external_ref, nome, cpf, email, telefone )`,
      )
      .eq('external_ref', entregaId)
      .single();
    if (entErr || !ent) return json({ error: 'entrega não encontrada' }, 404);

    const uni = ent.unidades as unknown as {
      identificacao: string;
      area_m2: number | string | null;
      empreendimentos: { nome: string; cidade: string; uf: string };
    };
    const cli = ent.clientes as unknown as {
      nome: string;
      cpf: string;
      email: string;
      telefone: string;
    };

    // Modelo: escolhido pelo TIPO, como a tela já faz (confissão x recebimento).
    const ehConfissao = /confiss/i.test(tipo);
    const { data: modelos, error: modErr } = await admin
      .from('modelos')
      .select('nome, conteudo')
      .order('created_at', { ascending: true });
    if (modErr) return json({ error: 'falha ao ler modelos' }, 500);
    const modelo =
      (modelos ?? []).find((m: { nome: string }) =>
        ehConfissao ? /confiss/i.test(m.nome) : /(entrega|recebimento)/i.test(m.nome),
      ) ?? (modelos ?? [])[0];
    if (!modelo) return json({ error: 'nenhum modelo de termo cadastrado' }, 422);

    const ctx: ContextoTermo = {
      cliente: { nome: cli.nome, cpf: cli.cpf, email: cli.email, telefone: cli.telefone },
      unidade: {
        identificacao: uni.identificacao,
        areaM2: uni.area_m2 == null ? null : Number(uni.area_m2),
      },
      empreendimento: uni.empreendimentos,
      // TODO: `financeiro` e os `extras` da dívida ainda não têm fonte — virão da
      // carteira do Mega (Fabric). Enquanto isso, são reportados como pendências.
    };

    const vazias = variaveisVazias(modelo.conteudo, ctx);
    const conteudo = renderTermo(modelo.conteudo, ctx);
    const bytes = await montarPdf(tipo, conteudo);
    const sha256 = await sha256Hex(bytes);
    const storagePath = `entregas/${entregaId}/${ehConfissao ? 'confissao-divida' : 'recebimento-chaves'}.pdf`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true });
    if (upErr) return json({ error: `falha ao subir o PDF: ${upErr.message}` }, 500);

    // `variaveisVazias` sobe junto para quem chamou decidir: um termo de
    // confissão sem o valor da dívida não deve seguir para assinatura.
    return json({ storagePath, sha256, bytes: bytes.length, variaveisVazias: vazias }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'erro ao gerar o PDF' }, 500);
  }
});
