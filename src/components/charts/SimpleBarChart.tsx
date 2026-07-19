/**
 * Lightweight SVG bar chart for count-by / profile top-N data.
 * No external chart dependency.
 */

export type BarDatum = {
  label: string;
  value: number;
};

export function SimpleBarChart({
  data,
  height = 200,
  className,
}: {
  data: BarDatum[];
  height?: number;
  className?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const barH = 18;
  const gap = 6;
  const labelW = 120;
  const chartW = 320;
  const totalH = data.length * (barH + gap);

  return (
    <div className={className} style={{ maxHeight: height, overflow: 'auto' }}>
      <svg
        width="100%"
        height={totalH}
        viewBox={`0 0 ${labelW + chartW + 48} ${totalH}`}
        className="text-xs"
      >
        {data.map((d, i) => {
          const y = i * (barH + gap);
          const w = (d.value / max) * chartW;
          const label =
            d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label;
          return (
            <g key={i} transform={`translate(0, ${y})`}>
              <title>{`${d.label}: ${d.value}`}</title>
              <text
                x={labelW - 8}
                y={barH / 2 + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={11}
              >
                {label}
              </text>
              <rect
                x={labelW}
                y={0}
                width={Math.max(w, 1)}
                height={barH}
                rx={3}
                className="fill-primary/70"
              />
              <text
                x={labelW + w + 6}
                y={barH / 2 + 4}
                className="fill-foreground"
                fontSize={11}
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
