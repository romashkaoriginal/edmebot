import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    console.error("UI crashed", {
      message: error instanceof Error ? error.message : String(error),
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error__card">
          <p className="fatal-error__eyebrow">Ошибка приложения</p>
          <h1>Экран не загрузился</h1>
          <p>Обновите страницу. Если ошибка повторится, отправьте администратору время её появления.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Обновить страницу
          </button>
        </div>
      </main>
    );
  }
}
