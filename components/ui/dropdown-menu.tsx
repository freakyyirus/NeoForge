"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  onSelect?: () => void;
}

const DropdownMenu = ({ children }: DropdownMenuProps) => {
  return <>{children}</>;
};

const DropdownMenuTrigger = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuItemProps & { position?: { x: number; y: number } }>(
  ({ className, position, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 min-w-[180px] rounded-lg border-4 border-black bg-white p-1 shadow-[6px_6px_0px_0px_#000]",
          className
        )}
        style={{
          left: position?.x,
          top: position?.y,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, children, onSelect, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
          className
        )}
        onClick={() => onSelect?.()}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("my-1 h-[2px] bg-black", className)} {...props} />
  )
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator };
