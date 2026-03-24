# 🏫 EduSchool — Gestão de Turmas, Professores e Disciplinas

Plataforma web para gestão de informação escolar (turmas, professores e disciplinas), com autenticação por perfis e atualizações em tempo real.

---

## 🚀 Instalação

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+
- [XAMPP](https://www.apachefriends.org/) (ou qualquer servidor MySQL)

### 1. Estrutura de ficheiros

```
projeto/
├── server.js          ← (server_simples.js renomeado)
├── db.js
├── package.json
└── public/
    ├── index.html     ← (index_simples.html renomeado)
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
3. Clica em **SQL**, cola o conteúdo de `eduscheduler_simples.sql` e clica **Executar**

### 4. Configurar ligação à base de dados

Abre o `db.js` e confirma as credenciais:

```js
const pool = mysql.createPool({
  host:     'localhost',
  user:     'root',
  password: '',      // muda se tiveres password no MySQL
  database: 'eduscheduler_simples',
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
| **Professor** | Ver tudo, sem editar | Password especial: `prof2024` |
| **Admin** | Adicionar e apagar registos | Password especial: `admin2024` |

> As passwords especiais podem ser alteradas no `server.js` na variável `ROLE_PASSWORDS`.

---

## ✨ Funcionalidades

- **🏫 Turmas** — lista de turmas com nome, ano e área
- **👨‍🏫 Professores** — lista de docentes com nome e email
- **📚 Disciplinas** — lista de disciplinas com ícone
- **🔄 Tempo Real** — alterações aparecem automaticamente para todos os utilizadores sem recarregar a página (Socket.io)
- **📱 Mobile Friendly** — sidebar em drawer, funciona em telemóvel e tablet
- **🔒 Permissões** — admin pode editar, professor e aluno só veem

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|-----------|-----|
| Node.js + Express | Servidor e API |
| MySQL + phpMyAdmin | Base de dados |
| mysql2 | Driver Node.js para MySQL |
| Socket.io | Atualizações em tempo real |
| bcryptjs | Hash de passwords |
| express-session | Gestão de sessões |
| HTML / CSS / JS | Interface |

---

## 📁 Estrutura de Ficheiros

```
projeto/
├── server.js          — Servidor e todas as rotas da API
├── db.js              — Ligação ao MySQL
├── eduscheduler_simples.sql — Script para criar a base de dados
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
