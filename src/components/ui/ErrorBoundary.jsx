import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[50dvh] p-6 text-center">
                    <div className="bg-destructive/10 p-4 rounded-full mb-4 text-destructive">
                        <AlertTriangle size={32} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                    <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                        {this.state.error?.message || "An unexpected error occurred."}
                    </p>
                    <Button
                        onClick={() => this.setState({ hasError: false })}
                        variant="outline"
                    >
                        Try again
                    </Button>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 text-xs text-muted-foreground underline"
                    >
                        Reload Page
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
