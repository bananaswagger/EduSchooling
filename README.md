# 📅 EduScheduler — Sistema de Gestão de Horários Escolares

Plataforma web completa para gestão de horários escolares, com autenticação por perfis, tempo real e diagrama de Gantt.

---

## 🚀 Instalação

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+
- [XAMPP](https://www.apachefriends.org/) (ou qualquer servidor MySQL)

### 1. Clonar / copiar os ficheiros

```
projeto/
├── server.js
├── db.js
├── package.json
└── public/
    ├── index.html
    ├── login.html
    └── css/
        └── style.css
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Criar a base de dados

1. Abre o XAMPP e arranca **Apache** e **MySQL**
2. Vai a `http://localhost/phpmyadmin`
3. Clica em **SQL**, cola o conteúdo de `eduscheduler.sql` e clica **Executar**

### 4. Configurar ligação à base de dados

Abre o `db.js` e confirma as credenciais:

```js
const pool = mysql.createPool({
  host:     'localhost',
  user:     'root',
  password: '',      // muda se tiveres password no MySQL
  database: 'eduscheduler',
});
```

### 5. Arrancar o servidor

```bash
npm start
```

Acede a **http://localhost:3000**

---

## 🔑 Credenciais de Demo

| Conta | Email | Password |
|-------|-------|----------|
| Administrador | `admin@escola.pt` | `admin123` |

---

## 👥 Perfis de Utilizador

| Perfil | Permissões | Registo |
|--------|-----------|---------|
| **Aluno** | Ver tudo, sem editar | Livre |
| **Professor** | Criar e editar aulas | Password especial: `prof2024` |
| **Admin** | Acesso total + gerir utilizadores | Password especial: `admin2024` |

> As passwords especiais podem ser alteradas no `server.js` na variável `ROLE_PASSWORDS`.

---

## ✨ Funcionalidades

- **📅 Horário Semanal** — vista de grelha com todas as aulas da semana
- **📋 Lista de Aulas** — lista por dia com detalhes de cada aula
- **📊 Diagrama de Gantt** — distribuição visual das disciplinas ao longo da semana
- **📚 Disciplinas** — cards com resumo de cada disciplina
- **👤 Professores** — lista de todos os docentes
- **📈 Estatísticas** — gráficos de horas por dia
- **🔄 Tempo Real** — alterações aparecem automaticamente para todos os utilizadores (Socket.io)
- **🚫 Validação de Conflitos** — impede que um professor dê aulas em duas turmas ao mesmo tempo
- **📱 Mobile Friendly** — funciona em telemóvel e tablet

---

## 🗂️ Gestão (só Admin)

- Turmas, Professores, Disciplinas
- Utilizadores e alteração de perfis

---

## 🛠️ Tecnologias

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| Node.js | 18+ | Servidor |
| Express | 4.x | Framework HTTP |
| MySQL | 8.0 | Base de dados |
| mysql2 | 3.x | Driver MySQL |
| Socket.io | 4.x | Tempo real |
| bcryptjs | 2.x | Hash de passwords |
| express-session | 1.x | Sessões |
| HTML/CSS/JS | — | Frontend |

---

## 📁 Estrutura de Ficheiros

```
projeto/
├── server.js          — Servidor e todas as rotas da API
├── db.js              — Ligação ao MySQL
├── eduscheduler.sql   — Script para criar a base de dados
├── package.json       — Dependências
└── public/
    ├── index.html     — Página principal
    ├── login.html     — Login e registo
    └── css/
        └── style.css  — Estilos
```

---

## 🔒 Segurança

- Passwords guardadas com **bcrypt** (custo 12)
- Permissões validadas no **servidor** (não só no frontend)
- Sessões com expiração de 7 dias

---

## 👨‍💻 Autores

| Nome | Nº Aluno |
|------|---------|
| Martim Gamas | BA2720 |
| Francisco Ferreira | BA2718 |
| Luís Belchior | BA2681 |
| Rodrigo Trilho | BA2682 |

**Professor:** André Rolo  
**Escola:** Escola Profissional Bento de Jesus Caraça — Delegação do Barreiro  
**Curso:** Técnico de Gestão e Programação de Sistemas Informáticos  
**Ciclo:** 2024/2027
