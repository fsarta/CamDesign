mod routes_projects;

use axum::{
    routing::get,
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::env;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Carica variabili d'ambiente (se presente .env)
    dotenvy::dotenv().ok();

    println!("MOTUS NOVA Backend Starting...");

    // Connessione al database usando la stringa configurata
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5433/motus_nova".to_string());
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    println!("Connected to PostgreSQL Database!");
    
    // Add default cors for development
    let cors = CorsLayer::permissive();

    // Costruisci il router Axum
    let app = Router::new()
        .route("/health", get(|| async { "Motus Nova Backend OK" }))
        .nest("/api/projects", routes_projects::router())
        .layer(cors) // Enable CORS so Frontend can access it
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("Server running on http://127.0.0.1:3000");
    
    axum::serve(listener, app).await?;

    Ok(())
}
