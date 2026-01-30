import * as React from "react"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"

const Card = React.forwardRef(({ onClick, to, as, className, ...props }, ref) => {
    const allProps = {
        className: cn(
            "rounded-2xl border border-secondary/40 bg-card/50 text-card-foreground shadow-sm backdrop-blur-sm text-left block",
            className
        ),
        onClick,
        ...props
    }

    if (to) return <Link ref={ref} to={to} {...allProps} />
    if (as === "div") return <div ref={ref} {...allProps} />
    if (as === "button" || (!as && onClick)) return <button ref={ref} {...allProps} />
    return <div ref={ref} {...allProps} />
})
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "text-lg font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardContent }
