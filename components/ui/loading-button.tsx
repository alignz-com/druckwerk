"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

type LoadingButtonProps = ButtonProps & {
  loading?: boolean;
  loadingText?: string;
  spinner?: React.ReactNode;
  minWidthClassName?: string;
};

const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      loading = false,
      loadingText,
      spinner,
      disabled,
      children,
      className,
      minWidthClassName = "min-w-[160px]",
      ...props
    },
    ref,
  ) => {
    const content = loading ? (
      <span className="flex items-center gap-2 text-inherit">
        {spinner ?? <Loader2 className="size-4 animate-spin text-inherit" aria-hidden="true" />}
        <span className="text-inherit">{loadingText ?? children}</span>
      </span>
    ) : (
      <span className="flex items-center gap-2 text-inherit">{children}</span>
    );

    return (
      <Button
        ref={ref}
        className={cn(minWidthClassName, className)}
        disabled={disabled || loading}
        aria-busy={loading}
        data-loading={loading ? "true" : undefined}
        {...props}
      >
        {content}
      </Button>
    );
  },
);

LoadingButton.displayName = "LoadingButton";

export { LoadingButton };
