import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderTermo, variaveisVazias } from '@chaves/domain/termo';
import { verificarSignatario, listarPendencias } from '@chaves/domain/signatario';
import { formatCpf, onlyDigits } from '@chaves/domain/cpf';
import { TIPO_DOCUMENTO } from '@chaves/domain/types';
import { admin, exigirEquipe } from '../auth.js';
import { clicksignConfigurada, env } from '../env.js';
import { gerarTermoPdf } from '../pdf.js';
import { ClicksignError, enviarParaAssinatura } from '../clicksign.js';

/**
 * Envio da Confissão de Dívida para assinatura.
 *
 * Repare no que NÃO entra pelo corpo da requisição: nem o texto do termo, nem o
 * e-mail do signatário, nem o CPF. Tudo isso é lido do banco aqui dentro. O
 * cliente só diz QUAL entrega — se mandasse o conteúdo, quem controlasse o
 * navegador escolheria o que vai para a assinatura e para quem.
 */

const corpoEnvio = z.object({ entregaId: z.string().min(1) });

const BUCKET = 'documentos';

export async function registrarRotasClicksign(app: FastifyInstance): Promise<void> {
  app.post('/entregas/:id/confissao/enviar', { preHandler: exigirEquipe }, async (req, reply) => {
    if (!clicksignConfigurada) {
      return reply.code(503).send({ erro: 'Clicksign não configurada neste ambiente' });
    }

    const params = corpoEnvio.safeParse({ entregaId: (req.params as { id?: string }).id });
    if (!params.success) return reply.code(400).send({ erro: 'entregaId inválido' });
    const { entregaId } = params.data;

    // Grafo da entrega — do banco, com service_role.
    const { data: ent, error: entErr } = await admin
      .from('entregas')
      .select(
        `external_ref, status,
         unidades!inner ( external_ref, identificacao, area_m2,
           empreendimentos!inner ( external_ref, nome, cidade, uf ) ),
         clientes!inner ( external_ref, nome, cpf, email, telefone )`,
      )
      .eq('external_ref', entregaId)
      .maybeSingle();
    if (entErr) return reply.code(500).send({ erro: `falha ao ler a entrega: ${entErr.message}` });
    if (!ent) return reply.code(404).send({ erro: 'entrega não encontrada' });

    const uni = ent.unidades as unknown as {
      identificacao: string;
      area_m2: number | string | null;
      empreendimentos: { nome: string; cidade: string; uf: string };
    };
    const cliRow = ent.clientes as unknown as {
      external_ref: string;
      nome: string;
      cpf: string;
      email: string;
      telefone: string;
    };

    const cliente = {
      id: cliRow.external_ref,
      nome: cliRow.nome,
      cpf: cliRow.cpf,
      email: cliRow.email,
      telefone: cliRow.telefone,
      createdAt: '',
    };

    // Mesma regra da tela, aplicada de novo: a validação do front é UX, esta é a
    // que vale. Compartilhar a função é justamente o ganho do pacote de domínio.
    const pendencia = verificarSignatario(cliente);
    if (pendencia) {
      return reply.code(422).send({
        erro: `cadastro do cliente incompleto: falta ${listarPendencias(pendencia)}`,
        faltando: pendencia.faltando,
      });
    }

    // Modelo do termo, do banco.
    const { data: modelos, error: modErr } = await admin
      .from('modelos')
      .select('nome, conteudo')
      .order('created_at', { ascending: true });
    if (modErr) return reply.code(500).send({ erro: `falha ao ler modelos: ${modErr.message}` });
    const modelo = (modelos ?? []).find((m: { nome: string }) => /confiss/i.test(m.nome));
    if (!modelo) {
      return reply.code(422).send({ erro: 'nenhum modelo de confissão de dívida cadastrado' });
    }

    const contexto = {
      cliente,
      unidade: {
        id: '',
        empreendimentoId: '',
        identificacao: uni.identificacao,
        status: 'LIBERADA' as const,
        areaM2: uni.area_m2 == null ? null : Number(uni.area_m2),
        createdAt: '',
      },
      empreendimento: {
        id: '',
        nome: uni.empreendimentos.nome,
        cidade: uni.empreendimentos.cidade,
        uf: uni.empreendimentos.uf,
        createdAt: '',
      },
      // TODO: `financeiro` virá da carteira do Mega (Fabric). Enquanto não vier,
      // as variáveis de dívida saem vazias e a checagem abaixo barra o envio.
    };

    const vazias = variaveisVazias(modelo.conteudo, contexto);
    if (vazias.length > 0) {
      return reply.code(422).send({
        erro:
          'o termo tem campos sem preenchimento e não pode ir para assinatura: ' +
          vazias.join(', '),
        variaveisVazias: vazias,
      });
    }

    const titulo = TIPO_DOCUMENTO.CONFISSAO_DIVIDA;
    const { pdf, sha256 } = await gerarTermoPdf(titulo, renderTermo(modelo.conteudo, contexto));

    const storagePath = `entregas/${entregaId}/confissao-divida.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true });
    if (upErr) return reply.code(500).send({ erro: `falha ao guardar o PDF: ${upErr.message}` });

    // Desvio de teste: enquanto a variável existir, nada chega a cliente real.
    const emailDestino = env.CLICKSIGN_EMAIL_TESTE ?? cliente.email;
    const modoTeste = env.CLICKSIGN_EMAIL_TESTE !== undefined;

    try {
      const r = await enviarParaAssinatura({
        nomeEnvelope: `${titulo} — ${uni.identificacao}${modoTeste ? ' [TESTE]' : ''}`,
        nomeArquivo: 'confissao-divida.pdf',
        pdf,
        signatario: {
          nome: cliente.nome,
          email: emailDestino,
          cpfFormatado: formatCpf(onlyDigits(cliente.cpf)),
        },
        metadata: { entregaId, tipo: titulo },
      });
      return reply.send({ ...r, storagePath, sha256, modoTeste, emailDestino });
    } catch (e) {
      if (e instanceof ClicksignError) {
        req.log.error({ status: e.status, corpo: e.corpo }, 'falha na Clicksign');
        return reply.code(502).send({ erro: e.message });
      }
      throw e;
    }
  });
}
