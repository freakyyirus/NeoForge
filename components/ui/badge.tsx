import * as React from "react";
import { cn } from "../../lib/utils";

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "destructive" | "success" | "warning";
}>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      success: "bg-success text-black",
      warning: "bg-warning text-black",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border-2 border-black px-3 py-1 text-xs font-bold",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
