const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * A real number. It never shows a value it is not: no count-up through false numbers.
 * The pane it sits on handles the entrance.
 */
export default function Counter({ value, className }: { value: number; className?: string }) {
  return <b className={className}>{fmt(value)}</b>;
}
