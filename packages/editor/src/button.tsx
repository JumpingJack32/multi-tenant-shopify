import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
    const variants: Record<string, string> = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      outline:
        "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    };
    const sizes: Record<string, string> = {
      sm: "h-8 px-3 text-xs rounded-md",
      icon: "h-8 w-8 rounded-md",
    };
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant] || variants.default} ${size ? sizes[size] : "h-9 px-4 py-2 text-sm rounded-md"} ${className}`}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
