use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
}

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/", get(list_projects).post(create_project))
        .route("/:id", get(get_project))
}

async fn list_projects(State(pool): State<PgPool>) -> Result<Json<Vec<Project>>, (StatusCode, String)> {
    let projects = sqlx::query_as!(
        Project,
        "SELECT id, name, description FROM projects ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(Json(projects))
}

async fn get_project(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, (StatusCode, String)> {
    let project = sqlx::query_as!(
        Project,
        "SELECT id, name, description FROM projects WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    if let Some(project) = project {
        Ok(Json(project))
    } else {
        Err((StatusCode::NOT_FOUND, "Project not found".into()))
    }
}

#[derive(Deserialize)]
struct CreateProjectPayload {
    name: String,
    description: Option<String>,
    workspace_id: Uuid,
}

async fn create_project(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateProjectPayload>,
) -> Result<(StatusCode, Json<Project>), (StatusCode, String)> {
    let project = sqlx::query_as!(
        Project,
        r#"
        INSERT INTO projects (workspace_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING id, name, description
        "#,
        payload.workspace_id,
        payload.name,
        payload.description
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok((StatusCode::CREATED, Json(project)))
}
