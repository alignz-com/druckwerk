"use client";

import { ReactNode, useEffect, useState } from "react";
import clsx from "clsx";

export type FlipCardProps = {
  front: ReactNode;
  back: ReactNode;
  activeSide: "front" | "back";
  className?: string;
};

export default function FlipCard({ front, back, activeSide, className }: FlipCardProps) {
  const [show, setShow] = useState<"front" | "back">(activeSide);

  useEffect(() => {
    setShow(activeSide);
  }, [activeSide]);

  return (
    <div className={clsx("relative", "[perspective:2000px]", className)}>
      <div
        className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d]"
        style={{ transform: show === "back" ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <div className="h-full w-full">{front}</div>
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="h-full w-full">{back}</div>
        </div>
      </div>
    </div>
  );
}
