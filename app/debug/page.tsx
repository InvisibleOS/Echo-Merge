"use client";

import { useEffect, useState } from "react";
import { getPriorities, getHotspots } from "@/lib/api";

export default function DebugPage() {
  const [result, setResult] = useState<string>("loading...");

  useEffect(() => {
    const envVal = process.env.NEXT_PUBLIC_USE_MOCK_DATA;
    let info = `NEXT_PUBLIC_USE_MOCK_DATA = "${envVal}" (type: ${typeof envVal})\n`;
    info += `USE_MOCK check: ${envVal === "true"}\n`;

    getPriorities()
      .then((data) => {
        info += `getPriorities() returned ${data.length} items\n`;
        if (data.length > 0) {
          info += `First item: ${JSON.stringify(data[0]).substring(0, 200)}\n`;
        }
        return getHotspots();
      })
      .then((data) => {
        info += `getHotspots() returned ${data.length} items\n`;
        setResult(info);
      })
      .catch((err) => {
        info += `ERROR: ${err.message}\n`;
        setResult(info);
      });
  }, []);

  return (
    <pre style={{ padding: "20px", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
      {result}
    </pre>
  );
}
