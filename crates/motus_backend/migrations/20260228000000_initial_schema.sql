-- TENANTS (multi-tenancy)
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT UNIQUE NOT NULL,        -- es. "acme-engineering"
    name        TEXT NOT NULL,
    plan        TEXT NOT NULL DEFAULT 'free', -- free, pro, enterprise
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    settings    JSONB NOT NULL DEFAULT '{}'
);

-- USERS
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'editor', -- owner, admin, editor, viewer
    auth_provider TEXT NOT NULL DEFAULT 'email', -- email, google, microsoft
    provider_id TEXT,
    avatar_url  TEXT,
    preferences JSONB NOT NULL DEFAULT '{}',
    last_seen   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email)
);

-- WORKSPACES
CREATE TABLE workspaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    settings    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id)
);

-- PROJECTS
CREATE TABLE projects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    version      INTEGER NOT NULL DEFAULT 1,
    status       TEXT NOT NULL DEFAULT 'draft', -- draft, review, approved, archived
    data         JSONB NOT NULL DEFAULT '{}',   -- progetto serializzato (formato .motus)
    crdt_state   BYTEA,                         -- stato CRDT Yjs per collaborazione
    thumbnail    TEXT,                          -- S3 key per anteprima
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID REFERENCES users(id),
    updated_by   UUID REFERENCES users(id)
);

-- PROJECT VERSIONS (history)
CREATE TABLE project_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version     INTEGER NOT NULL,
    data        JSONB NOT NULL,
    message     TEXT,                           -- commit message
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id),
    UNIQUE(project_id, version)
);

-- PROJECT MEMBERS (accesso per progetto)
CREATE TABLE project_members (
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'editor',
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(project_id, user_id)
);

-- INDICI RILEVANTI
CREATE INDEX idx_projects_workspace ON projects(workspace_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_versions_project ON project_versions(project_id, version DESC);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
