import React, { Component, ErrorInfo } from 'react';
import { AppProvider } from './contexts/AppContext';
import { Topbar } from './panels/Topbar';
import { Sidebar } from './panels/Sidebar';
import { MainView } from './panels/MainView';
import { StatusBar } from './panels/StatusBar';
import './index.css';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null; info: ErrorInfo | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'white', backgroundColor: '#880000', height: '100vh', overflow: 'auto' }}>
          <h1>Something went wrong.</h1>
          <h3 style={{ marginTop: '1rem' }}>{this.state.error?.toString()}</h3>
          <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Topbar />
      <main className="main-content" style={{ flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <MainView />
      </main>
      <StatusBar />
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
