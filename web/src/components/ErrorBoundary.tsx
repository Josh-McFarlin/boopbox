// SPDX-License-Identifier: GPL-3.0-only
// Catches an error thrown while a page renders and shows a short message instead of a blank page.
import type { ErrorInfo, ReactNode } from 'react'
import React, { Component } from 'react'

interface Props {
  children?: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    info: null,
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error) return <ErrorBoundaryFallbackComponent />
    return this.props.children
  }
}

export default ErrorBoundary

export const ErrorBoundaryFallbackComponent: React.FC = () => (
  <main className="flex min-h-screen min-w-full items-center justify-center">
    <section className="rounded-[5px] border-2 border-solid border-[#78909c] p-10 text-[24px] text-[#78909c]">
      Something went wrong. Reload the page.
    </section>
  </main>
)
ErrorBoundaryFallbackComponent.displayName = 'ErrorBoundaryFallbackComponent'
