import { Component } from 'react'
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="welcome"><h1>Something didn’t open correctly.</h1><p>Your saved data has not been cleared.</p><button className="secondary-button" onClick={() => window.location.reload()}>Reopen Pocket Memory</button></main>
    return this.props.children
  }
}
