# SIRETÓRIO — Sistema de Diretório e Frequência Multi-Ala

Sistema web (celular + computador) para gestão de alas: diretório de famílias,
qualificação da ala, rodízio/frequência sacramental e transmissão semanal.

## Módulos

- **Login multi-ala** — cada ala acessa apenas os próprios dados (Row Level
  Security no Supabase); usuário master tem painel de visualização geral.
- **Diretório** — famílias e membros da ala, com busca por nome/sobrenome.
- **Qualificação** — situação de residência de cada família (pendente /
  residente / saiu da ala).
- **Rodízio sacramental** — registro de presença por membro a cada domingo,
  justificativas de falta cadastradas, alerta de doença para a liderança e
  dashboard com taxa de rodízio e evolução semanal/mensal/anual.
- **Transmissão** — link semanal da live no YouTube por ala, com página pública
  de registro de participantes e cruzamento automático com o diretório.

## Estrutura

- `sql/schema.sql` — esquema completo do banco (rodar uma vez no SQL Editor do Supabase)
- `scripts/migrate.mjs` — migração dos dados do sistema antigo (Ala AC1)
- `src/` — aplicação web (Preact via CDN, sem etapa de build)

## Segurança

Segredos ficam em `.env` (fora do repositório). Dados pessoais de membros vivem
apenas no banco — nunca neste repositório.
