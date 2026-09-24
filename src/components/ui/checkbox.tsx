import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Checkbox nativo estilizado (sem dependência Radix — usado em poucos lugares).
 * Se o app adotar @radix-ui/react-checkbox no futuro, basta trocar este arquivo.
 */
const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
