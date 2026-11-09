"""
Dados-base dos modelos de cronograma do módulo Projetos.

Fonte funcional: Cronograma_Modelo_por_Tipo_de_Projeto.xlsx, enviado pelo usuário.
A planilha define somente:
- tipo/modelo de projeto;
- Sprint;
- descrição da Sprint;
- ordem e nome das tarefas;
- ordem e descrição das subtarefas.

Ela NÃO define duração, dependências, responsável, peso ou categoria.
Por isso, esses atributos continuam usando defaults técnicos nesta etapa.
A parametrização real de prazos/dias será tratada na etapa seguinte.
"""

MODELOS_CRONOGRAMA_PADRAO = [
    {
        "codigo": "desenvolvimento-sistema",
        "nome": "Desenvolvimento de Sistema",
        "etapas": [
            {
                "ordem": 1,
                "nome": "Sprint 1",
                "descricao": "Iniciação",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Levantamento de requisitos",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Reunião de abertura com o solicitante"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Documentar dores e necessidades do negócio"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Mapear usuários e perfis de acesso"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar entendimento com o solicitante"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar requisitos funcionais e não funcionais"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Definição de escopo (MVP)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Listar funcionalidades essenciais"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Listar funcionalidades desejáveis (fora do MVP)"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir premissas e restrições do projeto"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar escopo com stakeholder"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Formalizar termo de abertura/escopo"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Análise de viabilidade técnica",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Avaliar stack e tecnologias disponíveis"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar integrações necessárias"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Levantar riscos técnicos iniciais"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Avaliar impacto em sistemas existentes"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar viabilidade com o time técnico"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de stakeholders e comunicação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Identificar sponsor e pontos focais"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir canal de comunicação do projeto"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir periodicidade de status report"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Alinhar expectativas de prazo/entregas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar matriz RACI"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Aprovação e kick-off do projeto",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Consolidar documento de abertura"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Apresentar plano para aprovação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Obter aprovação formal do sponsor"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Realizar reunião de kick-off com o time"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Publicar cronograma inicial"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 2,
                "nome": "Sprint 2",
                "descricao": "Planejamento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Modelagem de dados",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Desenhar entidades e relacionamentos"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir chaves primárias/estrangeiras"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar modelo com o time técnico"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir nomenclatura de tabelas e campos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Revisar normalização do banco"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Definição de arquitetura",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Escolher padrão (monolito/API/microserviço)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir camadas (front, back, banco)"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir ambiente de hospedagem"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir padrões de segurança e autenticação"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar arquitetura definida"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Estimativa de esforço",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Quebrar escopo por módulo/tela"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Estimar horas por desenvolvedor"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar prazos com o time"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir critérios de aceite por entrega"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Consolidar cronograma de sprints"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de ambiente de desenvolvimento",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Configurar repositório de código"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir padrão de branches/versionamento"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Configurar ambiente de dev/homologação"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir pipeline de CI/CD"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar acessos da equipe"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Plano de testes",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir estratégia de testes (unitário, integração, aceite)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Elaborar casos de teste principais"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir critérios de saída de QA"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir ambiente de testes"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar plano com o time"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 3,
                "nome": "Sprint 3",
                "descricao": "Execução",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Desenvolvimento das telas",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Tela de listagem"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Tela de cadastro/edição"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Tela de detalhes/relatório"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Componentes de navegação e filtros"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Ajustes de responsividade"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Implementação das regras de negócio",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Validações de campo"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Cálculos e regras específicas"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Tratamento de exceções"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Regras de permissão/perfil de acesso"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Logs de auditoria das ações"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Desenvolvimento de endpoints",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "CRUD básico"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Endpoints de regra específica"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Documentação inline dos endpoints"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Versionamento da API interna"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Testes unitários dos endpoints"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Integração com sistemas externos/internos",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Mapear pontos de integração"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Implementar consumo/exposição de dados"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Tratar erros de integração"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar dados trocados"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Testar cenários de falha"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Revisão de código e qualidade",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Realizar code review por pares"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Aplicar padrões de código definidos"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Corrigir débitos técnicos identificados"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar cobertura de testes"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar documentação técnica"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 4,
                "nome": "Sprint 4",
                "descricao": "Monitoramento e Controle",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Testes de QA",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Teste funcional por tela"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Teste de regressão"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Registro e priorização de bugs"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Teste de usabilidade"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validação de performance"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Homologação com usuário-chave",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Apresentar sistema ao usuário-chave"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar feedback estruturado"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Ajustar conforme retorno"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar aderência ao escopo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Formalizar aceite parcial"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Correção de bugs",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Priorizar por criticidade"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Corrigir e re-testar"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar com QA"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Atualizar backlog de pendências"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Comunicar status ao stakeholder"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Acompanhamento do cronograma",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Atualizar status das entregas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar desvios de prazo"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Replanejar atividades em atraso"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Reportar riscos ao sponsor"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar indicadores do projeto"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Gestão de mudanças de escopo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Registrar solicitações de mudança"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Avaliar impacto em prazo/custo"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar aprovação da mudança"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Atualizar documentação de escopo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Comunicar mudança ao time"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 5,
                "nome": "Sprint 5",
                "descricao": "Encerramento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Deploy em produção",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Checklist de pré-deploy"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Deploy propriamente dito"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validação pós-deploy (smoke test)"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Monitoramento das primeiras horas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Plano de rollback (se necessário)"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Treinamento de usuários",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Preparar material/roteiro"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Realizar treinamento"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Coletar dúvidas e reforçar pontos"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Disponibilizar manual de uso"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Avaliar entendimento dos usuários"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Documentação e handover",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Documentar fluxo técnico"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Documentar para suporte"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Reunião de passagem para operação"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Atualizar repositório de documentação"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Definir responsável por manutenção"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Encerramento formal do projeto",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Validar entregas x escopo aprovado"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar aceite final do cliente/sponsor"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Registrar lições aprendidas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Encerrar cronograma e apontamentos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Arquivar documentação do projeto"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Avaliação pós-implantação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Acompanhar indicadores de uso"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar feedback pós-go-live"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar melhorias futuras (backlog v2)"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar estabilidade do sistema"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Reportar resultados ao sponsor"
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        "codigo": "integracao-api",
        "nome": "Integração / API",
        "etapas": [
            {
                "ordem": 1,
                "nome": "Sprint 1",
                "descricao": "Iniciação",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Identificação dos sistemas a integrar",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Mapear sistema de origem e destino"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar responsáveis técnicos de cada sistema"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Levantar documentação/API existente"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar restrições de acesso e segurança"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar ambiente de testes disponível"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Definição do escopo de dados trocados",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Listar entidades/campos a serem integrados"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir direção do fluxo (unidirecional/bidirecional)"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir frequência de sincronização"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir volumetria estimada de dados"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar escopo com áreas envolvidas"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Análise de viabilidade técnica",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Avaliar protocolo de comunicação (REST, SOAP etc.)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Verificar limites/rate limits das APIs envolvidas"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar riscos de compatibilidade"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Avaliar necessidade de middleware"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar viabilidade com o time técnico"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de stakeholders e comunicação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Identificar responsáveis por cada sistema"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir canal de comunicação entre equipes"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir periodicidade de status report"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Alinhar expectativas de prazo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar matriz de responsabilidades"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Aprovação e kick-off",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Consolidar escopo da integração"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Apresentar plano para aprovação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Obter aprovação formal das partes"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Realizar kick-off com times envolvidos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Publicar cronograma inicial"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 2,
                "nome": "Sprint 2",
                "descricao": "Planejamento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Documentação do contrato de API",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir endpoints e métodos"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir payloads de request/response"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir estratégia de autenticação (JWT/OAuth)"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir tratamento de erros padrão"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar contrato com sistemas envolvidos"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Mapeamento de campos (de-para)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Levantar campos de origem"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Levantar campos de destino"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir regras de transformação"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar campos obrigatórios/opcionais"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar de-para com áreas de negócio"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Definição de estratégia de autenticação e segurança",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir mecanismo de autenticação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir política de tokens/expiração"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir criptografia de dados sensíveis"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir controle de acesso por escopo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar com time de segurança"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de ambiente e infraestrutura",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Configurar ambiente de desenvolvimento"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Configurar ambiente de homologação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir servidor/hospedagem do conector"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir política de logs e monitoramento"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar acessos necessários"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Plano de testes de integração",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir cenários de teste (sucesso/erro)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir massa de dados de teste"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir critérios de aceite"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir ferramenta de teste (Postman/Insomnia)"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar plano com times envolvidos"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 3,
                "nome": "Sprint 3",
                "descricao": "Execução",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Desenvolvimento dos endpoints/conectores",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Implementar endpoints de consumo"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Implementar endpoints de exposição"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Implementar autenticação definida"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Implementar transformação de dados (de-para)"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar endpoints desenvolvidos"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Implementação de tratamento de erros e retries",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir estratégia de retry"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Implementar tratamento de timeout"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Implementar fila de reprocessamento"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Implementar alertas de falha"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Testar cenários de erro simulado"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Testes de integração ponta a ponta",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Testar fluxo completo (origem-destino)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Validar consistência dos dados"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Testar cenários de exceção"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar performance da integração"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Corrigir inconsistências encontradas"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Implementação de logs e monitoramento",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Implementar log de requisições"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Implementar log de erros"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Configurar dashboard de monitoramento"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir alertas automáticos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar rastreabilidade das transações"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Revisão de código e segurança",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Realizar code review"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Validar tratamento de dados sensíveis"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Aplicar padrões de segurança (OWASP)"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Corrigir vulnerabilidades identificadas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar documentação técnica"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 4,
                "nome": "Sprint 4",
                "descricao": "Monitoramento e Controle",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Testes de carga/performance",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir cenário de carga esperado"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Executar testes de carga"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar tempo de resposta"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar gargalos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Ajustar configurações de performance"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Validação de logs e monitoramento de falhas",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Revisar logs gerados em homologação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Validar alertas configurados"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Corrigir falhas de rastreabilidade"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar SLA de resposta"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Ajustar volume de log conforme necessidade"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Ajustes de timeout e resiliência",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Ajustar timeouts de conexão"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Ajustar política de retry"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Testar cenários de indisponibilidade"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar circuit breaker (se aplicável)"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar comportamento em falha parcial"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Acompanhamento do cronograma",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Atualizar status das entregas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar desvios de prazo"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Replanejar atividades em atraso"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Reportar riscos às partes envolvidas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar indicadores do projeto"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Gestão de mudanças de escopo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Registrar solicitações de mudança de contrato"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Avaliar impacto em prazo/sistemas"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar aprovação da mudança"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Atualizar documentação do contrato"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Comunicar mudança às equipes"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 5,
                "nome": "Sprint 5",
                "descricao": "Encerramento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Publicação em produção com monitoramento ativo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Checklist de pré-publicação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Publicar integração em produção"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar primeiras transações reais"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Monitorar primeiras 24-48h"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Plano de rollback (se necessário)"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Documentação da API",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Documentar autenticação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Documentar todos os endpoints"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Documentar exemplos de request/response"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Documentar tratamento de erros"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Publicar documentação para consulta"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Repasse para equipe de suporte/mesa",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Apresentar integração para o suporte"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Repassar cenários de erro comuns"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir fluxo de escalonamento"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar acesso do suporte aos logs"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Formalizar responsáveis pela manutenção"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Encerramento formal do projeto",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Validar entregas x escopo aprovado"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar aceite final das partes"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Registrar lições aprendidas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Encerrar cronograma e apontamentos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Arquivar documentação da integração"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Avaliação pós-implantação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Acompanhar indicadores de uso da integração"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar feedback das áreas envolvidas"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar melhorias futuras"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar estabilidade em produção"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Reportar resultados às partes envolvidas"
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        "codigo": "dashboard-bi",
        "nome": "Dashboard / BI",
        "etapas": [
            {
                "ordem": 1,
                "nome": "Sprint 1",
                "descricao": "Iniciação",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Entendimento das perguntas de negócio",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Reunião com stakeholder solicitante"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Levantar perguntas-chave a responder"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar indicadores prioritários"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar objetivo do dashboard"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar expectativas de uso"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Identificação das fontes de dados",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Mapear sistemas de origem dos dados"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Validar qualidade/disponibilidade dos dados"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar responsáveis pelas bases"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Verificar acesso às fontes"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar limitações de dados identificadas"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Análise de viabilidade técnica",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Avaliar volume de dados envolvido"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Avaliar necessidade de ETL intermediário"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Verificar performance esperada de atualização"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar riscos técnicos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar viabilidade com o time técnico"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de stakeholders e comunicação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Identificar sponsor e usuários-chave"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir canal de comunicação do projeto"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir periodicidade de status report"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Alinhar expectativas de prazo/entregas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar matriz de responsabilidades"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Aprovação e kick-off",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Consolidar escopo do dashboard"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Apresentar plano para aprovação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Obter aprovação formal do sponsor"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Realizar kick-off com o time"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Publicar cronograma inicial"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 2,
                "nome": "Sprint 2",
                "descricao": "Planejamento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Modelagem do modelo de dados (star schema)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir tabelas fato e dimensão"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir relacionamentos entre tabelas"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar modelo com o time técnico"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir granularidade dos dados"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar modelo definido"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Definição de KPIs e medidas DAX principais",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Listar KPIs a serem calculados"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir fórmulas de negócio de cada KPI"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar regras com áreas de negócio"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Priorizar medidas essenciais x complementares"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar dicionário de medidas"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Wireframe do dashboard",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir páginas do dashboard"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir layout e hierarquia visual"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir filtros e segmentações"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar wireframe com stakeholder"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Ajustar conforme feedback inicial"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de ambiente e infraestrutura",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir fonte de publicação (Power BI Service/On-premises)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Configurar gateway de dados (se necessário)"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir política de atualização de dados"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir controle de acesso/workspace"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar acessos necessários"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Plano de validação dos dados",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir critérios de validação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir amostras para conferência"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir responsáveis pela validação"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir cronograma de validações"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar plano com áreas de negócio"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 3,
                "nome": "Sprint 3",
                "descricao": "Execução",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "ETL/Power Query",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Extrair dados das fontes identificadas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Tratar e limpar dados (nulos, duplicidades)"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Padronizar formatos e nomenclaturas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Otimizar consultas de carga"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar transformações aplicadas"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Criação das medidas DAX",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Desenvolver medidas base"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Desenvolver medidas de comparação (YoY, MoM)"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Desenvolver medidas de acumulado"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Testar medidas com dados reais"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Otimizar performance das medidas"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Construção das visualizações e páginas",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Construir página de visão geral"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Construir páginas de detalhamento"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Configurar filtros e segmentações"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Aplicar identidade visual (Qore)"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Configurar drill-down/drill-through"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Integração e automação de atualização",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Configurar atualização agendada dos dados"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Testar atualização automática"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Configurar alertas de falha de atualização"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar tempo de processamento"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar rotina de atualização"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Revisão técnica do modelo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Revisar relacionamentos do modelo"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Revisar medidas quanto à performance"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar boas práticas de modelagem"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Corrigir inconsistências identificadas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar documentação técnica"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 4,
                "nome": "Sprint 4",
                "descricao": "Monitoramento e Controle",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Validação dos números com áreas de negócio",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Apresentar dashboard para validação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Conferir números com relatórios existentes"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Registrar divergências encontradas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Ajustar medidas conforme necessário"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Formalizar validação dos dados"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Revisão de performance do modelo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Analisar tempo de carregamento"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Otimizar medidas DAX identificadas como lentas"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Revisar relacionamentos e cardinalidade"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar tamanho do arquivo/modelo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Testar performance com usuários simultâneos"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Ajustes visuais e de usabilidade",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Coletar feedback de usabilidade"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Ajustar cores, fontes e layout"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Ajustar textos e rótulos"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar responsividade (mobile/web)"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Revisar acessibilidade das cores"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Acompanhamento do cronograma",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Atualizar status das entregas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar desvios de prazo"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Replanejar atividades em atraso"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Reportar riscos ao sponsor"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar indicadores do projeto"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Gestão de mudanças de escopo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Registrar solicitações de novos KPIs/páginas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Avaliar impacto em prazo/modelo"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar aprovação da mudança"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Atualizar documentação de escopo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Comunicar mudança ao time"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 5,
                "nome": "Sprint 5",
                "descricao": "Encerramento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Publicação no Power BI Service / geração do .pbit",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Checklist de pré-publicação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Publicar no workspace definido"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Gerar arquivo de template (.pbit)"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar acesso dos usuários finais"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Monitorar primeira atualização em produção"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Treinamento dos usuários finais",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Preparar material/roteiro de uso"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Realizar treinamento de navegação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Explicar interpretação dos KPIs"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Coletar dúvidas e reforçar pontos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Disponibilizar manual de uso"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Documentação das medidas e regras de negócio",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Documentar dicionário de medidas DAX"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Documentar fontes e transformações"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Documentar regras de negócio aplicadas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Publicar documentação para consulta"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Definir responsável por manutenção"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Encerramento formal do projeto",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Validar entregas x escopo aprovado"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar aceite final do sponsor"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Registrar lições aprendidas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Encerrar cronograma e apontamentos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Arquivar documentação do projeto"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Avaliação pós-implantação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Acompanhar uso do dashboard"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar feedback pós-entrega"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar melhorias futuras (v2)"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar estabilidade das atualizações"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Reportar resultados ao sponsor"
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        "codigo": "rpa-automacao",
        "nome": "RPA / Automação",
        "etapas": [
            {
                "ordem": 1,
                "nome": "Sprint 1",
                "descricao": "Iniciação",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Mapeamento do processo manual atual (as-is)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Reunião com executores do processo"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Documentar passo a passo atual"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar tempo médio gasto no processo"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar exceções e regras de negócio"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar mapeamento com a área"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Identificação de ganhos e viabilidade",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Estimar ganho de produtividade"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Estimar redução de erros"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Avaliar complexidade de automação"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar riscos de automação"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar viabilidade com stakeholder"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Análise de viabilidade técnica",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Avaliar sistemas envolvidos no processo"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Verificar estabilidade das telas/sistemas (RPA)"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Verificar disponibilidade de API (alternativa ao RPA)"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar riscos técnicos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar viabilidade com o time técnico"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de stakeholders e comunicação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Identificar sponsor e usuários do processo"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir canal de comunicação do projeto"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir periodicidade de status report"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Alinhar expectativas de prazo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar matriz de responsabilidades"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Aprovação e kick-off",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Consolidar escopo da automação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Apresentar plano para aprovação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Obter aprovação formal do sponsor"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Realizar kick-off com o time"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Publicar cronograma inicial"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 2,
                "nome": "Sprint 2",
                "descricao": "Planejamento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Desenho do fluxo automatizado (to-be)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Redesenhar processo com automação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar pontos de decisão automatizados"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar fluxo com a área de negócio"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir indicadores de sucesso do robô"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar fluxograma to-be"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Definição de exceções e regras de tratamento de erro",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Mapear exceções conhecidas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir regra de tratamento para cada exceção"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir fluxo de escalonamento humano"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir política de re-execução"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar regras com a área"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Escolha de ferramenta/tecnologia",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Avaliar ferramentas disponíveis (Python, UiPath etc.)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Avaliar custo x benefício da ferramenta"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar aderência técnica da equipe"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir ambiente de execução do robô"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Formalizar escolha da tecnologia"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de ambiente e infraestrutura",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Configurar ambiente de desenvolvimento"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Configurar credenciais/acessos necessários"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir servidor/máquina de execução"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir política de logs e monitoramento"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar acessos com áreas de TI/segurança"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Plano de testes",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir cenários de teste (sucesso/exceção)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir massa de dados de teste"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir critérios de aceite"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir ambiente de testes"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar plano com a área"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 3,
                "nome": "Sprint 3",
                "descricao": "Execução",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Desenvolvimento do robô/script",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Implementar fluxo principal"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Implementar tratamento das exceções mapeadas"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Implementar integrações necessárias"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Parametrizar variáveis de configuração"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Realizar testes unitários do robô"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Implementação de logs e alertas de falha",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Implementar log de execução"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Implementar log de erros/exceções"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Configurar alertas automáticos de falha"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Configurar notificação de conclusão"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar rastreabilidade das execuções"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Testes com massa de dados real",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Executar robô com dados reais (ambiente controlado)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Validar resultados comparados ao processo manual"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Corrigir inconsistências encontradas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar tempo de execução"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Ajustar performance do robô"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Documentação técnica do robô",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Documentar fluxo implementado"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Documentar variáveis e parâmetros"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Documentar exceções tratadas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Documentar dependências (sistemas/credenciais)"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Revisar documentação com o time"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Revisão de código e segurança",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Realizar code review"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Validar tratamento de credenciais sensíveis"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Aplicar boas práticas de segurança"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Corrigir vulnerabilidades identificadas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar documentação técnica"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 4,
                "nome": "Sprint 4",
                "descricao": "Monitoramento e Controle",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Execução em ambiente controlado (piloto)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir período de piloto"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Executar robô em paralelo ao processo manual"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Comparar resultados robô x manual"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Coletar feedback da área usuária"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Ajustar robô conforme resultados"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Validação de exceções não mapeadas",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Identificar exceções não previstas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir tratamento para novas exceções"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Atualizar robô com novas regras"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Re-testar cenários ajustados"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar com a área de negócio"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Ajustes de estabilidade",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Analisar falhas ocorridas no piloto"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Ajustar tempos de espera/sincronização"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Melhorar tratamento de instabilidade de sistemas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar taxa de sucesso do robô"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar ajustes realizados"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Acompanhamento do cronograma",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Atualizar status das entregas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar desvios de prazo"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Replanejar atividades em atraso"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Reportar riscos ao sponsor"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar indicadores do projeto"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Gestão de mudanças de escopo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Registrar solicitações de mudança no processo"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Avaliar impacto em prazo/robô"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar aprovação da mudança"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Atualizar documentação do fluxo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Comunicar mudança à área"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 5,
                "nome": "Sprint 5",
                "descricao": "Encerramento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Deploy em produção com agendamento",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Checklist de pré-deploy"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Publicar robô em produção"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Configurar agendamento de execução"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar primeira execução real"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Definir plano de contingência (execução manual)"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Documentação do processo automatizado",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Documentar processo as-is x to-be"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Documentar fluxo final do robô"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Documentar exceções e tratamentos"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Publicar documentação para consulta"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Definir responsável por manutenção"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Repasse de monitoramento para operação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Apresentar robô para equipe de operação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Repassar procedimento de acompanhamento diário"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir fluxo de escalonamento de falhas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar acesso da operação aos logs"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Formalizar responsáveis pela manutenção"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Encerramento formal do projeto",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Validar entregas x escopo aprovado"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar aceite final do sponsor"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Registrar lições aprendidas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Encerrar cronograma e apontamentos"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Arquivar documentação do projeto"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Avaliação pós-implantação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Acompanhar indicadores de execução (taxa de sucesso)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Medir ganho real de produtividade"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Coletar feedback da área após go-live"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar melhorias futuras"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Reportar resultados ao sponsor"
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        "codigo": "implantacao-cliente",
        "nome": "Implantação / Onboarding",
        "etapas": [
            {
                "ordem": 1,
                "nome": "Sprint 1",
                "descricao": "Iniciação",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Reunião de kick-off com cliente",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Apresentar equipe e metodologia"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Alinhar expectativas do cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Apresentar cronograma macro"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir canais de comunicação"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar ata de kick-off"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Levantamento de necessidades e particularidades do cliente",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Mapear estrutura organizacional do cliente"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Levantar processos específicos do cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar customizações necessárias"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Identificar integrações específicas do cliente"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar levantamento com o cliente"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Análise de viabilidade e escopo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Validar escopo contratado x levantado"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar riscos de implantação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar gaps entre contrato e necessidade real"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Alinhar tratativas de gaps com o cliente"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar viabilidade com o time técnico"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Definição de stakeholders e comunicação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Identificar responsáveis do lado cliente"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir canal de comunicação do projeto"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir periodicidade de status report"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Alinhar expectativas de prazo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Registrar matriz de responsabilidades (RACI)"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Aprovação e formalização do início",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Consolidar escopo de implantação"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Apresentar cronograma para aprovação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Obter aprovação formal do cliente"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Formalizar início do projeto"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Publicar cronograma detalhado"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 2,
                "nome": "Sprint 2",
                "descricao": "Planejamento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Definição de cronograma de implantação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir marcos/entregas principais"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir datas de validação com cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir data alvo de go-live"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar cronograma com o cliente"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Publicar cronograma oficial"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Mapeamento de parametrizações necessárias",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Levantar parâmetros do sistema a configurar"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir regras específicas do cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir perfis de acesso necessários"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar parametrizações com o cliente"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar parametrizações definidas"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Definição de responsáveis (cliente x Qore)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir responsável técnico do cliente"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir responsável funcional do cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir responsável Qore por frente"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Formalizar matriz de responsabilidades"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar disponibilidade das partes"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Planejamento de migração de dados",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir dados a serem migrados"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir formato de extração dos dados"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir regras de tratamento/carga"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar volumetria de dados"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Definir plano de contingência de migração"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Plano de testes de aceite",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir cenários de teste (UAT)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Definir critérios de aceite"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Definir responsáveis pelos testes"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Definir cronograma de testes"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Validar plano com o cliente"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 3,
                "nome": "Sprint 3",
                "descricao": "Execução",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Configuração/parametrização do sistema para o cliente",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Configurar parâmetros gerais do sistema"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Configurar regras específicas do cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Configurar fluxos/processos do cliente"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar configurações com o time técnico"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar configurações realizadas"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Migração/carga de dados iniciais",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Extrair dados da base de origem"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Tratar e validar dados extraídos"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Realizar carga em ambiente de testes"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar integridade dos dados migrados"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Corrigir inconsistências encontradas"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Configuração de acessos e permissões",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Cadastrar usuários do cliente"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Configurar perfis de acesso"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar permissões por perfil"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Testar acesso dos usuários-chave"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar política de acessos"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Configuração de integrações do cliente",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Configurar integrações específicas necessárias"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Testar integrações em ambiente de homologação"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar dados trocados nas integrações"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Corrigir inconsistências identificadas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar integrações configuradas"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Revisão técnica pré-homologação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Revisar configurações realizadas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Revisar dados migrados"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar aderência ao escopo contratado"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Corrigir pendências identificadas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Preparar ambiente para testes com cliente"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 4,
                "nome": "Sprint 4",
                "descricao": "Monitoramento e Controle",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Testes de aceite com o cliente (UAT)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Apresentar ambiente configurado ao cliente"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Executar cenários de teste definidos"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Registrar não conformidades encontradas"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Corrigir pendências identificadas"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Formalizar aceite dos testes"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Acompanhamento de primeiros dias de uso (hipercare)",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Definir equipe de suporte dedicado (hipercare)"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Monitorar chamados/dúvidas do período"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Priorizar e resolver problemas críticos"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Registrar lições aprendidas do período"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Reportar status diário ao cliente"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Ajustes de configuração conforme feedback",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Coletar feedback de uso real"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Priorizar ajustes necessários"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Implementar ajustes de configuração"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar ajustes com o cliente"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Documentar mudanças realizadas"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Acompanhamento do cronograma",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Atualizar status das entregas"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Identificar desvios de prazo"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Replanejar atividades em atraso"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Reportar riscos ao cliente/sponsor"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar indicadores do projeto"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Gestão de mudanças de escopo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Registrar solicitações de mudança do cliente"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Avaliar impacto em prazo/configuração"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar aprovação da mudança"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Atualizar documentação de escopo"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Comunicar mudança às partes"
                            }
                        ]
                    }
                ]
            },
            {
                "ordem": 5,
                "nome": "Sprint 5",
                "descricao": "Encerramento",
                "tarefas": [
                    {
                        "ordem": 1,
                        "nome": "Go-live oficial",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Checklist de pré-go-live"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Realizar corte para produção"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Validar operação em ambiente real"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Monitorar primeiras transações/uso"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Comunicar go-live às partes envolvidas"
                            }
                        ]
                    },
                    {
                        "ordem": 2,
                        "nome": "Treinamento final dos usuários do cliente",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Preparar material/roteiro de treinamento"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Realizar treinamento com usuários finais"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Coletar dúvidas e reforçar pontos"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Disponibilizar manual de uso"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Avaliar entendimento dos usuários"
                            }
                        ]
                    },
                    {
                        "ordem": 3,
                        "nome": "Encerramento formal e transição para suporte contínuo",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Validar entregas x escopo contratado"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar aceite final do cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Realizar reunião de transição para suporte"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Formalizar encerramento do projeto"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Arquivar documentação da implantação"
                            }
                        ]
                    },
                    {
                        "ordem": 4,
                        "nome": "Registro de lições aprendidas",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Coletar percepções da equipe do projeto"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Coletar percepções do cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Documentar pontos de melhoria"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Compartilhar aprendizados com o time"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Atualizar processo padrão de implantação"
                            }
                        ]
                    },
                    {
                        "ordem": 5,
                        "nome": "Avaliação pós-implantação",
                        "subtarefas": [
                            {
                                "ordem": 1,
                                "descricao": "Acompanhar indicadores de uso pós go-live"
                            },
                            {
                                "ordem": 2,
                                "descricao": "Realizar pesquisa de satisfação com o cliente"
                            },
                            {
                                "ordem": 3,
                                "descricao": "Identificar oportunidades de upsell/melhoria"
                            },
                            {
                                "ordem": 4,
                                "descricao": "Validar estabilidade da operação"
                            },
                            {
                                "ordem": 5,
                                "descricao": "Reportar resultados finais ao sponsor"
                            }
                        ]
                    }
                ]
            }
        ]
    }
]
