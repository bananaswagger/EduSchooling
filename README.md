# 📅 EduScheduler

Sistema de gestão de horários escolares — Node.js + Express + SQLite.

---

## 🚀 Instalação e arranque

```bash
# 1. Instalar dependências
npm install

# 2. Arrancar o servidor
npm start

# (Desenvolvimento com hot-reload)
npm run dev
```

Abre o browser em → **http://localhost:3000**

---

## 🗂️ Estrutura do projeto

```
eduscheduler/
├── src/
│   ├── server.js     # Servidor Express + todas as rotas REST
│   └── db.js         # Base de dados SQLite (schema + seed)
├── public/
│   ├── index.html    # Frontend SPA
│   ├── css/style.css
│   └── js/app.js
├── data/
│   └── escola.db     # Criado automaticamente
└── package.json
```

---

## 🔌 API REST

### Turmas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/turmas` | Listar turmas |
| POST | `/api/turmas` | Criar turma `{nome, ano, area}` |
| PUT | `/api/turmas/:id` | Editar turma |
| DELETE | `/api/turmas/:id` | Apagar turma (e aulas) |

### Professores
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/professores` | Listar professores |
| POST | `/api/professores` | `{nome, email?, grupo?}` |
| PUT | `/api/professores/:id` | Editar |
| DELETE | `/api/professores/:id` | Apagar |

### Tipos de Disciplina
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/tipos` | Listar tipos |
| POST | `/api/tipos` | `{nome, cor, bg}` |
| PUT | `/api/tipos/:id` | Editar |
| DELETE | `/api/tipos/:id` | Apagar (se não usado) |

### Disciplinas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/disciplinas` | Listar disciplinas |
| POST | `/api/disciplinas` | `{nome, icone?, tipo_id, abreviatura?}` |
| PUT | `/api/disciplinas/:id` | Editar |
| DELETE | `/api/disciplinas/:id` | Apagar (se sem aulas) |

### Aulas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/aulas` | Listar (query: `turma_id`, `dia`, `tipo`) |
| GET | `/api/aulas/conflitos` | Verificar conflitos de horário |
| POST | `/api/aulas` | `{turma_id, disciplina_id, professor_id, dia_semana, hora_inicio, duracao, sala}` |
| PUT | `/api/aulas/:id` | Editar aula |
| DELETE | `/api/aulas/:id` | Apagar aula |

### Stats
| Método | Rota |
|--------|------|
| GET | `/api/stats?turma_id=1` |

---

## 🗃️ Schema da base de dados

```sql
turmas           -- 10.º A, 11.º B, etc.
professores      -- nome, email, grupo de recrutamento
tipos_disciplina -- Obrigatória, Opcional, Extracurricular, etc.
disciplinas      -- nome, ícone, tipo, cores
aulas            -- turma + disciplina + professor + dia + hora + sala

VIEW v_aulas     -- join completo para queries simples
```

---

## ✨ Funcionalidades

- **5 vistas**: Horário semanal, Lista, Disciplinas, Professores, Estatísticas
- **6 tipos de disciplina** com cores personalizáveis
- **Filtro por tipo** em tempo real
- **CRUD completo** via painel lateral (Turmas, Professores, Tipos, Disciplinas)
- **Deteção de conflitos** de horário (turma e professor)
- **Dados persistentes** em SQLite (`data/escola.db`)
- **Seed automático** com horário de exemplo no primeiro arranque
