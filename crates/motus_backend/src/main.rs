use axum::{
    routing::get,
    Router,
};
use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() {
    // Carica variabili d'ambiente fittizie se presenti nel file .env
    dotenvy::dotenv().ok();

    // Leggi la URL del DB
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // Connessione al database
    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to connect to the database");

    // Crea l'app Axum
    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .with_state(pool);

    // Esegui il web server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();
    
    println!("Server running on http://localhost:3000");
    
    axum::serve(listener, app).await.unwrap();
}
