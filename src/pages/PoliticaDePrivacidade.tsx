import { Link } from 'react-router-dom';
import { LegalH2, LegalLayout, LegalP, LegalUl } from '@/components/layout/LegalLayout';

export function PoliticaDePrivacidade(): React.JSX.Element {
  return (
    <LegalLayout titulo="Política de Privacidade" atualizadoEm="07/07/2026">
      <LegalP>
        Esta Política de Privacidade explica como a <strong>Rottas Construtora e
        Incorporadora</strong> (&ldquo;Rottas&rdquo;), na condição de controladora, trata os dados
        pessoais dos usuários da plataforma <strong>Chaves na Mão</strong>, em conformidade com a
        Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
      </LegalP>

      <LegalH2>1. Quais dados coletamos</LegalH2>
      <LegalUl>
        <li>
          <strong>Dados de identificação:</strong> nome e e-mail, obtidos automaticamente do seu
          login com conta Microsoft (Microsoft Entra ID). Não coletamos nem armazenamos senha.
        </li>
        <li>
          <strong>Dados do contrato:</strong> empreendimento, unidade adquirida e informações
          contratuais vinculadas à sua compra junto à Rottas.
        </li>
        <li>
          <strong>Registros de uso:</strong> registros técnicos de acesso e de ações relevantes na
          plataforma (auditoria), para segurança e comprovação de operações.
        </li>
      </LegalUl>

      <LegalH2>2. Para que usamos os dados</LegalH2>
      <LegalUl>
        <li>Identificar você e vincular sua conta ao seu contrato, empreendimento e unidade.</li>
        <li>
          Disponibilizar contrato, documentos e informações do empreendimento, e acompanhar o
          processo de entrega das chaves.
        </li>
        <li>Garantir a segurança da plataforma e cumprir obrigações legais e contratuais.</li>
      </LegalUl>
      <LegalP>
        <strong>
          Não utilizamos seus dados para publicidade paga, tráfego pago, marketing ou qualquer
          finalidade comercial alheia à plataforma. Não vendemos nem compartilhamos seus dados com
          terceiros para esses fins.
        </strong>
      </LegalP>

      <LegalH2>3. Onde e como armazenamos</LegalH2>
      <LegalP>
        Os dados são armazenados em infraestrutura de nuvem (Supabase), com acesso restrito por
        políticas de segurança em nível de banco de dados (RLS), criptografia em trânsito e
        controle de permissões por papel. Somente pessoas autorizadas da Rottas acessam os dados, e
        apenas na medida necessária para a operação.
      </LegalP>

      <LegalH2>4. Compartilhamento</LegalH2>
      <LegalP>
        Compartilhamos dados apenas com operadores essenciais ao funcionamento da plataforma (como
        provedores de infraestrutura e de assinatura eletrônica de documentos), sempre limitado ao
        necessário, ou quando exigido por lei ou ordem de autoridade competente.
      </LegalP>

      <LegalH2>5. Seus direitos (art. 18 da LGPD)</LegalH2>
      <LegalUl>
        <li>Confirmar a existência de tratamento e acessar seus dados.</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
        <li>Solicitar portabilidade, anonimização ou eliminação de dados.</li>
        <li>Revogar o consentimento e excluir sua conta.</li>
      </LegalUl>
      <LegalP>
        Para excluir sua conta, acesse <strong>Perfil → Excluir minha conta</strong>. A exclusão é
        permanente e irreversível e remove todas as informações da sua conta na plataforma.
        Documentos que a Rottas tenha obrigação legal ou contratual de manter (por exemplo,
        contratos assinados) são preservados pelos prazos exigidos em lei, com acesso restrito.
      </LegalP>

      <LegalH2>6. Retenção</LegalH2>
      <LegalP>
        Mantemos os dados apenas pelo tempo necessário às finalidades desta Política ou pelos
        prazos legais aplicáveis. Após esses prazos, os dados são eliminados ou anonimizados.
      </LegalP>

      <LegalH2>7. Contato e encarregado (DPO)</LegalH2>
      <LegalP>
        Para exercer seus direitos ou tirar dúvidas sobre esta Política, entre em contato com a
        Rottas pelos canais oficiais de atendimento.
      </LegalP>

      <LegalP>
        Consulte também os nossos{' '}
        <Link to="/termos-de-uso" className="text-primary underline-offset-2 hover:underline">
          Termos de Uso
        </Link>
        .
      </LegalP>
    </LegalLayout>
  );
}
