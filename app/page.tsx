"use client";

import DropZone from "@/components/DropZone";
import Reader from "@/components/Reader";
import { StoreProvider, useStore } from "@/lib/store";

function App() {
  const { paper, openPaper } = useStore();
  return paper ? <Reader /> : <DropZone onFile={openPaper} />;
}

export default function Home() {
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}
