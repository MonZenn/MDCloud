import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose'
});

export const MermaidBlock: React.FC<{ chart: string }> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error rendering diagram');
      }
    };
    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="p-3 bg-red-950/40 border border-red-800 rounded text-red-300 text-sm font-mono">
        Failed to render diagram: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 p-4 bg-slate-950/60 rounded-lg flex justify-center overflow-x-auto border border-slate-800"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
