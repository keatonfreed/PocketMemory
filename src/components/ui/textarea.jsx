import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, onInput, ...props }, ref) => {
    const internalRef = React.useRef(null)
    const combinedRef = (node) => {
        internalRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
    }

    const adjustHeight = React.useCallback(() => {
        const textarea = internalRef.current
        if (textarea) {
            textarea.style.height = "auto"
            textarea.style.height = `${textarea.scrollHeight}px`
        }
    }, [])

    React.useEffect(() => {
        adjustHeight()
        // Handle window resize
        window.addEventListener("resize", adjustHeight)
        return () => window.removeEventListener("resize", adjustHeight)
    }, [adjustHeight, props.value])

    const handleInput = (e) => {
        adjustHeight()
        if (onInput) onInput(e)
    }

    return (
        <textarea
            ref={combinedRef}
            onInput={handleInput}
            className={cn(
                "flex min-h-[80px] w-full bg-transparent px-3 py-2 text-lg ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 font-light resize-none transition-[height] duration-200 ease-out",
                className
            )}
            {...props}
        />
    )
})
Textarea.displayName = "Textarea"

export { Textarea }
