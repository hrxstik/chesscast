import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  contained?: boolean;
};

export function Section({
  className,
  children,
  contained = true,
  ...props
}: SectionProps) {
  return (
    <section className={cn(className)} {...props}>
      <div
        className={cn(
          /* Ширину задаёт родительский Container в (root)/layout и др.; здесь только полная ширина колонки */
          contained && "w-full",
        )}
      >
        {children}
      </div>
    </section>
  );
}
