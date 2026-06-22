import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  maxFontPx?: number;
  minFontPx?: number;
  className?: string;
}

const AutoFitText = ({ text, maxFontPx = 14, minFontPx = 9, className }: Props) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontPx);

  useEffect(() => {
    const fit = () => {
      const c = containerRef.current;
      const t = textRef.current;
      if (!c || !t) return;
      let size = maxFontPx;
      t.style.fontSize = `${size}px`;
      while (size > minFontPx && t.scrollWidth > c.clientWidth) {
        size -= 0.5;
        t.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text, maxFontPx, minFontPx]);

  return (
    <span ref={containerRef} className={className} style={{ display: "block", overflow: "hidden", whiteSpace: "nowrap", width: "100%" }}>
      <span ref={textRef} style={{ fontSize: `${fontSize}px`, display: "inline-block", lineHeight: 1.2 }}>{text}</span>
    </span>
  );
};

export default AutoFitText;
