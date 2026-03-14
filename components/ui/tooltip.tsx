"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
}

const TooltipContext = React.createContext<{
  side: "top" | "bottom" | "left" | "right";
  delayDuration: number;
}>({
  side: "top",
  delayDuration: 300,
});

const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <TooltipContext.Provider value={{ side: "top", delayDuration: 300 }}>
      {children}
    </TooltipContext.Provider>
  );
};

const Tooltip = ({ content, children, side = "top", delayDuration = 300 }: TooltipProps) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delayDuration);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative inline-block" onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      {isVisible && (
        <div
          className={cn(
            "absolute z-50 whitespace-nowrap rounded-md border-2 border-black bg-black px-3 py-1 text-xs font-bold text-white shadow-[2px_2px_0px_0px_#666]",
            positionStyles[side]
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export { Tooltip, TooltipProvider };
