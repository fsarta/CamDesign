# MOTUS NOVA

**MOTUS NOVA** is a professional, open-source cam design and analysis tool. It allows mechanical engineers and designers to synthesize kinematic profiles using VDI 2143 standard motion laws, analyze the dynamic characteristics, and generate accurate cam contours for manufacturing.

## Features

- **VDI 2143 Motion Laws**: Full support for standard laws including Cycloidal, Modified Sine, Modified Trapezoid, Polynomial (3-4-5, 4-5-6-7), Harmonic, and custom Bézier profiles.
- **Interactive Kinematic Charts**: Real-time display of displacement, velocity, acceleration, and jerk profiles.
- **Cam Contour Generation**: Supports both rotary (disc) and linear (plate) cams with translating roller followers.
- **Diagnostics**: Real-time calculation of pressure angle, radius of curvature, and cyclic continuity.
- **High Performance**: Mathematical engine written in Rust and compiled to WebAssembly (WASM) for native-level browser performance.
- **Multi-Tenant Architecture**: Ready for cloud deployment with an Axum (Rust) backend and PostgreSQL.

## Architecture

The project is structured as a monorepo containing multiple crates and apps:

```text
MOTUS NOVA
├── apps/
│   └── web/                # Frontend: React 19 + TypeScript + Vite
├── crates/
│   ├── motus_core/         # Core: Rust mathematical engine (VDI 2143, Kinematics)
│   ├── motus_wasm/         # Bridge: wasm-bindgen interface for the frontend
│   ├── motus_backend/      # Backend: Axum + SQLx (PostgreSQL) REST API
│   └── motus_cli/          # CLI: Terminal interface (Work in progress)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v20+)
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)

### 1. Build the WASM module

The mathematical engine needs to be compiled to WebAssembly before running the frontend.

```bash
cd crates/motus_wasm
wasm-pack build --target web
```

### 2. Run the Frontend

The React app is located in `apps/web`.

```bash
cd apps/web
pnpm install
pnpm run dev
```

The application will be available at `http://localhost:5173`.

### 3. Run the Backend (Optional)

If you wish to use the persistence features, you need to start the backend and its database.

```bash
# Start the PostgreSQL database
docker-compose up -d

# Run the backend
cd crates/motus_backend
cargo run
```

## Contributing

We welcome contributions! Please check the issues page or submit a Pull Request.

When working on the mathematical core (`motus_core`), ensure you run the test suite with strict tolerances:

```bash
cargo test -p motus_core
```

## License

This project is licensed under the MIT License.
